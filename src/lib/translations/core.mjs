import { createHash } from 'node:crypto'

export const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const ENGINE_VERSION = 1
export const policyHash = (locale, glossary, providerVersion) =>
  hash([ENGINE_VERSION, locale, glossary, providerVersion])
const targets = new Set(['en', 'ja'])
export const documentKey = (kind, slug) => {
  if (!['posts', 'pages', 'projects', 'thoughts', 'journey'].includes(kind) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw new Error('Invalid translation document key')
  return `${kind}:${slug}`
}

// Translate text slots only. The model never owns the Notion structure, URLs, annotations or code.
export function segmentsOf(document) {
  const segments = []
  for (const name of ['title', 'seoTitle', 'description', 'defaultDescription', 'imageDescription']) {
    const value =
      name === 'imageDescription'
        ? document.image?.description
        : name === 'seoTitle'
          ? document.seo?.title
          : name === 'description'
            ? document.seo
              ? document.seo.description
              : document.description
            : document[name]
    if (value) segments.push({ key: name, texts: [value], paths: [[name]] })
  }
  function walk(blocks) {
    for (const block of blocks || []) {
      const paths = [],
        texts = []
      const body = block[block.type] || {}
      const add = (items, prefix) =>
        (items || []).forEach((item, index) => {
          if (item.type !== 'text' || item.annotations?.code) return
          const text = item.text?.content ?? item.plain_text ?? ''
          if (!text.trim() || /^https?:\/\/\S+$/.test(text)) return
          paths.push([...prefix, index])
          texts.push(text)
        })
      if (block.type !== 'code') add(body.rich_text, ['rich_text'])
      add(body.caption, ['caption'])
      for (const [index, cell] of (body.cells || []).entries()) add(cell, ['cells', index])
      if (texts.length) segments.push({ key: `block:${block.id}`, texts, paths })
      walk(block.children)
    }
  }
  walk(document.content?.blocks)
  return segments
}

// Omit editing timestamps and expiring Notion media URLs from content identity.
export function stableContent(value) {
  if (Array.isArray(value)) return value.map(stableContent)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) =>
          ![
            'created_time',
            'last_edited_time',
            'created_by',
            'last_edited_by',
            'expiry_time',
            'request_id',
            'sys',
            'readingTime'
          ].includes(key)
      )
      .map(([key, item]) => [
        key,
        key === 'file' && item?.url
          ? { source: 'notion-file' }
          : key === 'image' && item?.source === 'notion-file'
            ? stableContent({ ...item, url: undefined })
            : stableContent(item)
      ])
  )
}

export function sourceHash(document) {
  return hash(stableContent(document))
}

export function materialize(document, segments) {
  const result = structuredClone(document)
  const definitions = new Map(segmentsOf(document).map((segment) => [segment.key, segment]))
  const byId = new Map()
  const walk = (blocks) => {
    for (const block of blocks || []) {
      byId.set(block.id, block)
      walk(block.children)
    }
  }
  walk(result.content?.blocks)
  for (const [key, record] of Object.entries(segments)) {
    const definition = definitions.get(key)
    if (!definition) continue
    if (key.startsWith('block:')) {
      const block = byId.get(key.slice(6))
      definition.paths.forEach((path, index) => {
        let item = block[block.type]
        for (const part of path) item = item[part]
        item.text.content = record.texts[index]
        item.plain_text = record.texts[index]
      })
    } else if (key === 'seoTitle') result.seo.title = record.texts[0]
    else if (key === 'description') {
      if (result.seo) result.seo.description = record.texts[0]
      else result.description = record.texts[0]
    } else if (key === 'imageDescription' && result.image) result.image.description = record.texts[0]
    else result[key] = record.texts[0]
  }
  return result
}

export function validateTexts(texts, source) {
  if (
    !Array.isArray(texts) ||
    texts.length !== source.length ||
    texts.some((value) => typeof value !== 'string' || !value.trim())
  )
    throw new Error('Invalid translation shape or empty text')
  // Markdown entered inside a Notion text slot still retains its protected syntax.
  const protectedTokens = (text) => text.match(/```[\s\S]*?```|`[^`]+`|!?\[[^\]]*\]\([^)]*\)|https?:\/\/[^\s)]+/g) || []
  for (let i = 0; i < source.length; i++) {
    for (const token of protectedTokens(source[i])) {
      // Markdown labels can be translated, but the link target cannot change.
      const target = token.match(/\]\(([^)]*)\)$/)?.[1]
      if (target ? !texts[i].includes(`](${target})`) : !texts[i].includes(token))
        throw new Error('Translation changed protected code or link')
    }
  }
}

export async function translateDocument({
  document,
  locale,
  previous,
  translate,
  checkpoint = async () => {},
  glossary = {},
  providerVersion = '',
  now = () => new Date().toISOString()
}) {
  if (!targets.has(locale)) throw new Error('Unsupported target language')
  const revision = sourceHash(document)
  const policy = policyHash(locale, glossary, providerVersion)
  if (previous?.published?.sourceHash === revision && previous.published.policy === policy)
    return { ...previous, status: 'succeeded', reused: true }
  if (previous?.locked) return { ...previous, status: 'needs-review' }
  const segments = { ...previous?.segments }
  const active = {}
  for (const segment of segmentsOf(document)) {
    const fingerprint = hash([policy, segment.texts, segment.paths])
    const old = segments[segment.key]
    if (old?.locked && old.hash !== fingerprint) return { ...previous, segments, status: 'needs-review' }
    if (old?.hash === fingerprint) active[segment.key] = old
    else {
      const texts = await translate(segment.texts, { locale, glossary, key: segment.key })
      validateTexts(texts, segment.texts)
      active[segment.key] = { hash: fingerprint, texts, locked: false }
      segments[segment.key] = active[segment.key]
      await checkpoint(segments)
    }
  }
  const translated = materialize(document, active)
  return {
    segments: active,
    status: 'succeeded',
    locked: false,
    published: { sourceHash: revision, policy, generatedAt: now(), document: translated }
  }
}

// Refresh expiring file URLs from current Chinese source, without retranslating or storing new Chinese copies.
export function hydrateMedia(translated, source) {
  const result = structuredClone(translated)
  if (result.image && source.image?.source === 'notion-file') result.image.url = source.image.url
  const originals = new Map()
  const walk = (blocks, fn) => {
    for (const block of blocks || []) {
      fn(block)
      walk(block.children, fn)
    }
  }
  walk(source.content?.blocks, (block) => originals.set(block.id, block))
  walk(result.content?.blocks, (block) => {
    const current = originals.get(block.id)?.[block.type]
    if (current?.file) block[block.type].file = current.file
  })
  return result
}
