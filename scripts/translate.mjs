import { parseArgs } from 'node:util'
import { resolve } from 'node:path'
import { createTranslationSourceClient } from '../src/lib/translations/source-client.mjs'
import { documentKey } from '../src/lib/translations/core.mjs'
import { translateKind } from '../src/lib/translations/runner.mjs'
import { withStoreLock } from '../src/lib/translations/store.mjs'

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
const client = createTranslationSourceClient()

await withStoreLock(directory, async () => {
  if (!(await translateKind({ directory, client, values }))) process.exitCode = 1
})
