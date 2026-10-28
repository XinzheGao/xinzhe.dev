import { parseArgs } from 'node:util'
import { resolve, join } from 'node:path'
import { createNotionClient, NOTION_SOURCES } from '../src/lib/notion-client.mjs'
import { documentKey, policyHash, sourceHash, translateDocument } from '../src/lib/translations/core.mjs'
import { createTranslator } from '../src/lib/translations/provider.mjs'
import { readJSON, writeJSON, withStoreLock, stripMediaURLs } from '../src/lib/translations/store.mjs'

const { values } = parseArgs({
  options: {
    slug: { type: 'string' },
    kind: { type: 'string', default: 'posts' },
    locale: { type: 'string' },
    all: { type: 'boolean' },
    'dry-run': { type: 'boolean' },
    store: { type: 'string', default: 'translations' }
  }
})
const directory = resolve(values.store)
if (!values.all && !values.slug) throw new Error('Specify --slug <slug> or --all')
if (values.all && values.slug) throw new Error('Use --slug or --all, not both')
documentKey(values.kind, values.slug || 'all')
const locales = values.locale ? [values.locale] : ['en', 'ja']
if (locales.some((locale) => !['en', 'ja'].includes(locale))) throw new Error('Use --locale en or ja')
if (!process.env.NOTION_API_TOKEN) throw new Error('NOTION_API_TOKEN is not configured')
const sources = Object.fromEntries(
  Object.entries(NOTION_SOURCES).map(([key, value]) => [
    key,
    process.env[`NOTION_${key.toUpperCase()}_DATA_SOURCE_ID`] || value
  ])
)
const client = createNotionClient({ token: process.env.NOTION_API_TOKEN, sources })

await withStoreLock(directory, async () => {
  const catalogPath = join(directory, 'catalog.json')
  const jobsPath = join(directory, 'jobs.json')
  const catalog = await readJSON(catalogPath, { version: 1, documents: {} })
  const jobs = await readJSON(jobsPath, {})
  const glossary = await readJSON(join(directory, 'glossary.json'), {})
  const verificationPath = join(directory, 'verification.json')
  const verification = await readJSON(verificationPath, {})
  // Batch work must follow a successful real bilingual article run.
  if (values.all && !verification.bilingualArticleVerified)
    throw new Error('First complete one post in both languages using --kind posts --slug <slug>')
  const documents = await client[values.kind](false, values.slug)
  if (!documents.length && values.slug) throw new Error('No published Chinese document matches this slug')
  const translator = values['dry-run'] ? undefined : createTranslator()
  let failed = false
  for (const entry of documents) {
    const key = documentKey(values.kind, entry.slug)
    const document =
      values.kind === 'journey' ? entry : { ...entry, content: { blocks: await client.blocks(entry.id, true) } }
    // Refetch metadata after recursively loading blocks to avoid publishing a mixed revision.
    const [current] = await client[values.kind](false, entry.slug)
    if (!current || current.sys.publishedAt !== entry.sys.publishedAt) {
      console.error(`${key}: source changed while reading; retry on the next run`)
      failed = true
      continue
    }
    if (values['dry-run']) {
      console.log(JSON.stringify({ key, sourceHash: sourceHash(document), locales }))
      continue
    }
    catalog.documents[key] ??= {}
    for (const locale of locales) {
      const jobKey = `${key}:${locale}`
      const previous = catalog.documents[key][locale]
      const providerVersion = `${process.env.TRANSLATION_BASE_URL || 'https://api.deepseek.com'}/${process.env.TRANSLATION_MODEL}`
      if (
        previous?.published?.sourceHash === sourceHash(document) &&
        previous.published.policy === policyHash(locale, glossary[locale] || {}, providerVersion)
      ) {
        console.log(`${jobKey}: unchanged`)
        continue
      }
      const errors = jobs[jobKey]?.errors || []
      jobs[jobKey] = {
        state: 'running',
        attempts: (jobs[jobKey]?.attempts || 0) + 1,
        startedAt: new Date().toISOString(),
        errors,
        sourceHash: sourceHash(document)
      }
      await writeJSON(jobsPath, jobs)
      try {
        const result = await translateDocument({
          document,
          locale,
          previous,
          glossary: glossary[locale] || {},
          providerVersion,
          translate: translator,
          checkpoint: async (segments) => {
            catalog.documents[key][locale] = { ...previous, segments }
            await writeJSON(catalogPath, catalog)
          }
        })
        // Check publication visibility and revision once more before promoting a complete version.
        const [latest] = await client[values.kind](false, entry.slug)
        if (!latest || latest.sys.publishedAt !== entry.sys.publishedAt)
          throw new Error('Source changed during translation; previous published translation retained')
        if (result.published) result.published.document = stripMediaURLs(result.published.document)
        catalog.documents[key][locale] = result
        await writeJSON(catalogPath, catalog)
        jobs[jobKey] = { ...jobs[jobKey], state: result.status, finishedAt: new Date().toISOString(), error: null }
        if (result.status === 'needs-review') failed = true
        console.log(`${jobKey}: ${result.status}${result.reused ? ' (unchanged)' : ''}`)
      } catch (error) {
        failed = true
        // Only bounded, known error classes; raw provider errors and HTTP bodies never enter artifacts.
        const message =
          /^(Translation API HTTP \d+|Invalid translation shape or empty text|Translation changed protected code or link|Source changed during translation; previous published translation retained|Translation response was incomplete)$/.test(
            error.message
          )
            ? error.message
            : 'Translation failed; check provider configuration, network, or response format'
        jobs[jobKey] = {
          ...jobs[jobKey],
          state: 'failed',
          finishedAt: new Date().toISOString(),
          error: message,
          errors: [...errors, { at: new Date().toISOString(), message }].slice(-20)
        }
        console.error(`${jobKey}: ${message}`)
      }
      await writeJSON(jobsPath, jobs)
    }
    if (
      values.kind === 'posts' &&
      verification.sourceHash !== sourceHash(document) &&
      ['en', 'ja'].every((locale) => catalog.documents[key][locale]?.published?.sourceHash === sourceHash(document))
    ) {
      await writeJSON(verificationPath, {
        bilingualArticleVerified: true,
        key,
        sourceHash: sourceHash(document),
        verifiedAt: new Date().toISOString()
      })
    }
  }
  if (failed) process.exitCode = 1
})
