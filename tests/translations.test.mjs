import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  documentKey,
  hash,
  hydrateMedia,
  segmentsOf,
  sourceHash,
  translateDocument,
  validateTexts
} from '../src/lib/translations/core.mjs'
import { createTranslator } from '../src/lib/translations/provider.mjs'
import { readJSON, writeJSON, withStoreLock, stripMediaURLs } from '../src/lib/translations/store.mjs'
import { languageAlternates, localePath, splitLocale } from '../src/lib/locale-routing.mjs'

const rich = (text, extra = {}) => ({
  type: 'text',
  text: { content: text },
  plain_text: text,
  annotations: {},
  ...extra
})
const paragraph = (id, text) => ({ id, type: 'paragraph', paragraph: { rich_text: [rich(text)] } })
const fixture = () => ({
  id: 'article-id',
  slug: 'sample',
  title: '中文标题',
  seo: { title: 'SEO 标题', description: '中文摘要' },
  sys: { publishedAt: '2026-10-27' },
  content: {
    blocks: [
      { id: 'heading', type: 'heading_1', heading_1: { rich_text: [rich('第一节')] } },
      paragraph('a', '第一段'),
      paragraph('b', '第二段'),
      {
        id: 'code',
        type: 'code',
        code: { language: 'js', rich_text: [rich('const 中文 = 1')], caption: [rich('代码说明')] }
      },
      {
        id: 'link',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            rich('链接文字', {
              text: { content: '链接文字', link: { url: 'https://example.com' } },
              annotations: { bold: true }
            }),
            rich('原始代码', { annotations: { code: true } })
          ]
        }
      },
      {
        id: 'image',
        type: 'image',
        image: { file: { url: 'https://example.com/signed-a', expiry_time: 'soon' }, caption: [rich('图片说明')] }
      },
      {
        id: 'list',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: [rich('父项')] },
        children: [paragraph('child', '子段落')]
      },
      {
        id: 'table',
        type: 'table',
        table: {},
        children: [{ id: 'row', type: 'table_row', table_row: { cells: [[rich('单元格')]] } }]
      }
    ]
  }
})
const fake = async (texts, { locale }) => texts.map((text) => `${locale}:${text}`)

test('locale URLs preserve Chinese links, queries, hashes, external links and assets', () => {
  assert.deepEqual(splitLocale('/en/writing/a'), { locale: 'en', pathname: '/writing/a' })
  assert.equal(localePath('/ja/writing/a?x=1#b', 'en'), '/en/writing/a?x=1#b')
  assert.equal(localePath('/en', 'zh-CN'), '/')
  assert.equal(localePath('/en?x=1#intro', 'ja'), '/ja?x=1#intro')
  assert.equal(localePath('/writing/a', 'bad'), '/writing/a')
  for (const link of ['https://example.com', '//example.com', '#heading', '/assets/a.png', '/api/a', '/writing.xml'])
    assert.equal(localePath(link, 'ja'), link)
  assert.deepEqual(languageAlternates('/writing/a', 'en', ['zh-CN']), {
    canonical: '/en/writing/a',
    languages: { 'zh-CN': '/writing/a', 'x-default': '/writing/a' }
  })
  assert.throws(() => documentKey('posts', '../secret'))
})

test('complete bilingual translation preserves Notion structure, code, URLs, marks and original', async () => {
  const original = fixture(),
    untouched = structuredClone(original)
  for (const locale of ['en', 'ja']) {
    const result = await translateDocument({ document: original, locale, translate: fake })
    assert.equal(result.status, 'succeeded')
    const body = result.published.document.content.blocks
    assert.equal(result.published.document.title, `${locale}:中文标题`)
    assert.equal(result.published.document.seo.description, `${locale}:中文摘要`)
    assert.equal(body[3].code.rich_text[0].text.content, 'const 中文 = 1')
    assert.equal(body[4].paragraph.rich_text[0].text.link.url, 'https://example.com')
    assert.equal(body[4].paragraph.rich_text[0].annotations.bold, true)
    assert.equal(body[4].paragraph.rich_text[1].text.content, '原始代码')
    assert.equal(body[6].children[0].paragraph.rich_text[0].text.content, `${locale}:子段落`)
    assert.equal(body[7].children[0].table_row.cells[0][0].text.content, `${locale}:单元格`)
  }
  assert.deepEqual(original, untouched)
})

test('only edited paragraphs translate; block reorder, file expiry and timestamps reuse translations', async () => {
  const document = fixture()
  const initial = await translateDocument({ document, locale: 'en', translate: fake })
  let calls = 0
  const changed = structuredClone(document)
  changed.content.blocks[1].paragraph.rich_text = [rich('修改第一段')]
  const result = await translateDocument({
    document: changed,
    locale: 'en',
    previous: initial,
    translate: async (...args) => {
      calls++
      return fake(...args)
    }
  })
  assert.equal(calls, 1)
  assert.notEqual(initial.published.sourceHash, result.published.sourceHash)
  ;[changed.content.blocks[1], changed.content.blocks[2]] = [changed.content.blocks[2], changed.content.blocks[1]]
  calls = 0
  await translateDocument({
    document: changed,
    locale: 'en',
    previous: result,
    translate: async (...args) => {
      calls++
      return fake(...args)
    }
  })
  assert.equal(calls, 0)
  const renewed = structuredClone(document)
  renewed.sys.publishedAt = 'tomorrow'
  renewed.content.blocks[5].image.file.url = 'https://example.com/signed-b'
  assert.equal(sourceHash(document), sourceHash(renewed))
  assert.equal(
    hydrateMedia(initial.published.document, renewed).content.blocks[5].image.file.url,
    'https://example.com/signed-b'
  )
  assert.deepEqual(stripMediaURLs(initial.published.document).content.blocks[5].image.file, {})
})

test('failed attempt retains published version, saves checkpoints, and resumes without duplicate work', async () => {
  const document = fixture()
  const initial = await translateDocument({ document, locale: 'en', translate: fake })
  const changed = structuredClone(document)
  changed.title = '更新标题'
  changed.seo.description = '更新摘要'
  let checkpoints,
    calls = 0
  await assert.rejects(
    translateDocument({
      document: changed,
      locale: 'en',
      previous: initial,
      checkpoint: async (value) => {
        checkpoints = structuredClone(value)
      },
      translate: async (...args) => {
        if (++calls === 2) throw new Error('network')
        return fake(...args)
      }
    }),
    /network/
  )
  assert.equal(initial.published.document.title, 'en:中文标题')
  calls = 0
  const resumed = await translateDocument({
    document: changed,
    locale: 'en',
    previous: { ...initial, segments: checkpoints },
    translate: async (...args) => {
      calls++
      return fake(...args)
    }
  })
  assert.equal(calls, 1)
  assert.equal(resumed.published.document.seo.description, 'en:更新摘要')
})

test('manual locks stop changed source from replacing a published translation; glossary changes invalidate cache', async () => {
  const document = fixture()
  const initial = await translateDocument({ document, locale: 'ja', translate: fake })
  initial.segments['block:a'].locked = true
  initial.segments['block:a'].texts = ['人手による修正']
  const changed = structuredClone(document)
  changed.content.blocks[1].paragraph.rich_text = [rich('新原文')]
  const blocked = await translateDocument({
    document: changed,
    locale: 'ja',
    previous: initial,
    translate: () => {
      throw new Error('must not translate')
    }
  })
  assert.equal(blocked.status, 'needs-review')
  assert.deepEqual(blocked.published, initial.published)
  const locked = await translateDocument({
    document: changed,
    locale: 'ja',
    previous: { ...initial, locked: true },
    translate: fake
  })
  assert.equal(locked.status, 'needs-review')
  let count = 0
  const refreshed = await translateDocument({ document, locale: 'en', translate: fake })
  await translateDocument({
    document,
    locale: 'en',
    previous: refreshed,
    glossary: { 模型: 'model' },
    translate: async (...args) => {
      count++
      return fake(...args)
    }
  })
  assert.equal(count, segmentsOf(document).length)
})

test('provider retries transient errors, rejects truncation and malformed output, never accepts changed code/URLs', async () => {
  let count = 0
  const translate = createTranslator({
    apiKey: 'test-key',
    model: 'test-model',
    pause: async () => {},
    fetcher: async (_, options) => {
      assert.equal(JSON.parse(options.body).response_format.type, 'json_object')
      if (++count === 1) return new Response('', { status: 429 })
      return Response.json({
        choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ translations: ['Hello'] }) } }]
      })
    }
  })
  assert.deepEqual(await translate(['你好'], { locale: 'en', glossary: {} }), ['Hello'])
  assert.equal(count, 2)
  let denied = 0
  const unauthorized = createTranslator({
    apiKey: 'test-key',
    model: 'test-model',
    pause: async () => {},
    fetcher: async () => {
      denied++
      return new Response('secret upstream body', { status: 401 })
    }
  })
  await assert.rejects(unauthorized(['你好'], { locale: 'en' }), /^Error: Translation API HTTP 401$/)
  assert.equal(denied, 1)
  assert.throws(() => validateTexts(['changed `bad`'], ['保留 `code`']))
  assert.throws(() => validateTexts(['[translated](https://evil.com)'], ['[原文](https://example.com)']))
  validateTexts(['[translated](https://example.com)'], ['[原文](https://example.com)'])
  assert.throws(() => validateTexts([''], ['你好']))
  const truncated = createTranslator({
    apiKey: 'test-key',
    model: 'test-model',
    pause: async () => {},
    fetcher: async () => Response.json({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] })
  })
  await assert.rejects(truncated(['你好'], { locale: 'en' }), /incomplete/)
})

test('store serializes concurrent workers and writes complete JSON atomically', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'translations-'))
  try {
    await withStoreLock(directory, async () => {
      await assert.rejects(
        withStoreLock(directory, async () => {}),
        /already locked/
      )
      await writeJSON(join(directory, 'catalog.json'), { stable: hash('test') })
      assert.deepEqual(await readJSON(join(directory, 'catalog.json')), { stable: hash('test') })
    })
    await withStoreLock(directory, async () => {})
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
