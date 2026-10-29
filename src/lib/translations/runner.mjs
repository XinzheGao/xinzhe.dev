import { join } from 'node:path'
import { documentKey, policyHash, sourceHash, translateDocument } from './core.mjs'
import { createTranslator } from './provider.mjs'
import { readJSON, writeJSON, stripMediaURLs } from './store.mjs'

// Caller owns the store lock, including across all kinds in a complete scan.
export async function translateKind({ directory, client, values, translatorFactory = createTranslator }) {
  const locales = values.locale ? [values.locale] : ['en', 'ja']

  const catalogPath = join(directory, 'catalog.json')
  const jobsPath = join(directory, 'jobs.json')
  const catalog = await readJSON(catalogPath, { version: 1, documents: {} })
  const jobs = await readJSON(jobsPath, {})
  const glossary = await readJSON(join(directory, 'glossary.json'), {})
  const verificationPath = join(directory, 'verification.json')
  const verification = await readJSON(verificationPath, {})
  const documents = await client[values.kind](false, values.slug)
  if (!documents.length && values.slug) throw new Error('No published Chinese document matches this slug')
  let translator
  const translate = async (...args) => {
    translator ??= translatorFactory()
    return translator(...args)
  }
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
      // A locked source needs a human decision, not a new job commit on every unchanged scan.
      if (
        previous?.status === 'needs-review' &&
        jobs[jobKey]?.sourceHash === sourceHash(document) &&
        jobs[jobKey]?.reviewedAtSnapshot === (previous.reviewedAt || null)
      ) {
        failed = true
        console.log(`${jobKey}: needs-review (unchanged)`)
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
          translate,
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
        jobs[jobKey] = {
          ...jobs[jobKey],
          state: result.status,
          finishedAt: new Date().toISOString(),
          error: null,
          ...(result.status === 'needs-review' && { reviewedAtSnapshot: previous?.reviewedAt || null })
        }
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
      !verification.bilingualArticleVerified &&
      ['en', 'ja'].every((locale) => catalog.documents[key][locale]?.published?.sourceHash === sourceHash(document))
    ) {
      Object.assign(verification, {
        bilingualArticleVerified: true,
        key,
        sourceHash: sourceHash(document),
        verifiedAt: new Date().toISOString()
      })
      await writeJSON(verificationPath, verification)
    }
  }
  return !failed
}
