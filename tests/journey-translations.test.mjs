import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ADMIN_CATEGORIES,
  categorySources,
  getAdminCategory,
  translationPreviewPath
} from '../src/lib/translation-admin/categories.mjs'
import { createNotionClient } from '../src/lib/notion-client.mjs'
import { documentKey, hydrateMedia, segmentsOf, sourceHash, translateDocument } from '../src/lib/translations/core.mjs'
import { stripMediaURLs } from '../src/lib/translations/store.mjs'
import { validateTarget, recordRevision, reviewRecord } from '../src/lib/translation-admin/model.mjs'

const sample = () => ({
  id: 'aaaa-bbbb',
  slug: 'entry-aaaabbbb',
  title: '开始新的研究',
  date: '2025-04-01',
  description: '完成了第一个实验。查看[项目](https://example.com/project)。',
  image: { source: 'notion-file', url: 'https://example.com/signed-a', description: '实验现场' },
  sys: { publishedAt: '2026-10-29T00:00:00Z' }
})

test('admin categories follow public navigation and home/about select only their own page', () => {
  assert.deepEqual(
    ADMIN_CATEGORIES.map(({ label }) => label),
    ['首页', '文章', '作品', '随想', '旅程', '关于']
  )
  assert.equal(getAdminCategory('pages'), undefined)
  const pages = [{ slug: 'home' }, { slug: 'about' }, { slug: 'journey' }, { slug: 'writing' }]
  assert.deepEqual(categorySources(getAdminCategory('home'), pages), [{ slug: 'home' }])
  assert.deepEqual(categorySources(getAdminCategory('about'), pages), [{ slug: 'about' }])
  assert.equal(translationPreviewPath('pages', 'home', 'en'), '/en')
  assert.equal(translationPreviewPath('pages', 'about', 'ja'), '/ja/about')
  assert.equal(translationPreviewPath('journey', 'entry-aaaabbbb', 'ja'), '/ja/journey')
})

test('Notion journey entries expose stable identity, source version and selectable published records', async () => {
  const title = (content) => ({ title: [{ plain_text: content }] })
  const entry = (id, state, date) => ({
    id,
    last_edited_time: '2026-10-29T00:00:00Z',
    properties: {
      标题: title('研究记录'),
      状态: { status: { name: state } },
      日期: { date: { start: date } },
      简述: { rich_text: [{ plain_text: '研究进展' }] },
      图片: { files: [{ file: { url: 'https://example.com/image' }, name: '现场照片' }] }
    }
  })
  const client = createNotionClient({
    token: 'test',
    sources: { journey: 'journey-ds' },
    fetcher: async () =>
      Response.json({
        results: [
          entry('aaaa-bbbb', '已发布', '2025-04-01'),
          entry('cccc-dddd', '已发布', '2024-04-01'),
          entry('eeee-ffff', '草稿', '2026-04-01')
        ],
        has_more: false
      })
  })
  const records = await client.journey(false, 'entry-aaaabbbb')
  assert.equal(records.length, 1)
  assert.equal(records[0].id, 'aaaa-bbbb')
  assert.equal(records[0].sys.publishedAt, '2026-10-29T00:00:00Z')
  assert.equal(records[0].image.source, 'notion-file')
  assert.equal((await client.journey()).length, 2)
  assert.equal(documentKey('journey', records[0].slug), 'journey:entry-aaaabbbb')
  assert.equal(validateTarget({ kind: 'journey', slug: records[0].slug, locale: 'en' }).kind, 'journey')
})

test('journey translates title, brief and image caption while preserving dates, identity and media', async () => {
  const original = sample(),
    untouched = structuredClone(original)
  assert.deepEqual(
    segmentsOf(original).map(({ key }) => key),
    ['title', 'description', 'imageDescription']
  )
  for (const locale of ['en', 'ja']) {
    const record = await translateDocument({
      document: original,
      locale,
      translate: async (texts) => texts.map((text) => `${locale}:${text}`)
    })
    const result = record.published.document
    assert.equal(result.title, `${locale}:开始新的研究`)
    assert.equal(result.description, `${locale}:${original.description}`)
    assert.equal(result.image.description, `${locale}:实验现场`)
    assert.equal(result.date, original.date)
    assert.equal(result.slug, original.slug)
    assert.equal(result.image.url, original.image.url)
    assert.equal(result.content, undefined)
    const renewed = structuredClone(original)
    renewed.image.url = 'https://example.com/signed-b'
    assert.equal(sourceHash(renewed), sourceHash(original))
    assert.equal(stripMediaURLs(result).image.url, undefined)
    assert.equal(hydrateMedia(stripMediaURLs(result), renewed).image.url, renewed.image.url)
  }
  assert.deepEqual(original, untouched)
})

test('journey incremental updates and review reuse the existing paragraph cache and manual locks', async () => {
  const document = sample()
  const first = await translateDocument({
    document,
    locale: 'en',
    translate: async (texts) => texts.map((text) => `en:${text}`)
  })
  const updated = structuredClone(document)
  updated.description = '新的简述'
  let count = 0
  const next = await translateDocument({
    document: updated,
    locale: 'en',
    previous: first,
    translate: async (texts) => {
      count++
      return texts.map((text) => `en:${text}`)
    }
  })
  assert.equal(count, 1)
  const catalog = { version: 1, documents: { 'journey:entry-aaaabbbb': { en: next } } }
  reviewRecord(catalog, {
    kind: 'journey',
    slug: document.slug,
    locale: 'en',
    action: 'edit',
    segment: 'imageDescription',
    texts: ['Human caption'],
    revision: recordRevision(next)
  })
  assert.equal(next.published.document.image.description, 'Human caption')
  assert.equal(next.segments.imageDescription.locked, true)
  const changed = structuredClone(updated)
  changed.image.description = '新的图片说明'
  const blocked = await translateDocument({
    document: changed,
    locale: 'en',
    previous: next,
    translate: () => {
      throw new Error('must not overwrite')
    }
  })
  assert.equal(blocked.status, 'needs-review')
  assert.equal(blocked.published.document.image.description, 'Human caption')
})
