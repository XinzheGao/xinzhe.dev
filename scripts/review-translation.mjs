import { parseArgs } from 'node:util'
import { resolve, join } from 'node:path'
import { documentKey, materialize, validateTexts } from '../src/lib/translations/core.mjs'
import { readJSON, writeJSON, withStoreLock } from '../src/lib/translations/store.mjs'

const { values } = parseArgs({
  options: {
    kind: { type: 'string', default: 'posts' },
    slug: { type: 'string' },
    locale: { type: 'string' },
    segment: { type: 'string' },
    file: { type: 'string' },
    unlock: { type: 'boolean' },
    store: { type: 'string', default: 'translations' }
  }
})
const key = documentKey(values.kind, values.slug)
if (!['en', 'ja'].includes(values.locale)) throw new Error('Specify --locale en or ja')
const directory = resolve(values.store)
await withStoreLock(directory, async () => {
  const path = join(directory, 'catalog.json')
  const catalog = await readJSON(path)
  const record = catalog.documents[key]?.[values.locale]
  if (!record?.published) throw new Error('Generate a complete translation before editing')
  if (values.segment) {
    const segment = record.segments[values.segment]
    if (!segment) throw new Error('Unknown segment key')
    if (values.file) {
      const texts = await readJSON(resolve(values.file))
      validateTexts(texts, segment.texts)
      segment.texts = texts
      record.published.document = materialize(record.published.document, { [values.segment]: segment })
    }
    segment.locked = !values.unlock
  } else {
    if (values.file) throw new Error('Use --segment when supplying an edit file')
    record.locked = !values.unlock
  }
  record.reviewedAt = new Date().toISOString()
  await writeJSON(path, catalog)
  console.log(`${key}:${values.locale}: ${values.segment || 'document'} ${values.unlock ? 'unlocked' : 'locked'}`)
})
