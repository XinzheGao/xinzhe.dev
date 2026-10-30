import test from 'node:test'
import assert from 'node:assert/strict'
import { notionImageSource, journeyImageSource, resolveNotionImage } from '../src/lib/notion-images.mjs'
import { createNotionClient } from '../src/lib/notion-client.mjs'
import { hydrateMedia } from '../src/lib/translations/core.mjs'

const id = '4062f6e1-253b-800f-bb9c-d24646e8bb76'
const token = 'test-token'
const image = (url) => ({ id, type: 'image', image: { file: { url } } })
const source = notionImageSource(image('https://example.com/expired'), token)
const signed = new URL(source, 'https://example.com').searchParams.get('signature')

test('cached images keep a stable signed source as Notion URLs expire; external images stay direct', () => {
  assert.equal(source, notionImageSource(image('https://example.com/renewed'), token))
  assert.equal(notionImageSource({ id, image: { external: { url: 'https://example.com/photo' } } }, token), undefined)
  assert.equal(notionImageSource(image('https://example.com/photo'), undefined), undefined)
  assert.ok(!source.includes('test-token'))
})

test('each image request bypasses the Notion fetch cache and redirects to the renewed URL without caching', async () => {
  let requests = 0
  const client = createNotionClient({
    token,
    fetcher: async (url, init) => {
      assert.equal(url, `https://api.notion.com/v1/blocks/${id}`)
      assert.equal(init.cache, 'no-store')
      requests++
      return { ok: true, json: async () => image(`https://example.com/fresh-${requests}`) }
    }
  })
  for (let i = 1; i <= 2; i++) {
    const response = await resolveNotionImage({ id, signed, token, readBlock: (id) => client.block(id, true) })
    assert.equal(response.status, 307)
    assert.equal(response.headers.get('location'), `https://example.com/fresh-${i}`)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
  }
})

test('unsigned, tampered and rotated credentials cannot read private Notion blocks', async () => {
  for (const overrides of [{ signed: null }, { signed: 'x'.repeat(64) }, { signed: '0'.repeat(64) },
    { id: '4062f6e1-253b-800f-bb9c-d24646e8bb77' }, { id: '../private' }, { token: 'rotated' }]) {
    const response = await resolveNotionImage({
      id, signed, token, ...overrides,
      readBlock: () => assert.fail('Invalid requests must not reach Notion')
    })
    assert.equal(response.status, 404)
  }
})

test('deleted images and upstream failures return uncached errors', async () => {
  for (const [block, status] of [
    [{ ...image('https://example.com/image'), archived: true }, 404],
    [{ type: 'paragraph' }, 404],
    [image('http://example.com/image'), 502],
    [null, 502]
  ]) {
    const response = await resolveNotionImage({ id, signed, token, readBlock: async () => block })
    assert.equal(response.status, status)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
  }
})

const journey = (url) => ({ id, image: { source: 'notion-file', url, description: '现场' } })
const journeySource = journeyImageSource(journey('https://example.com/expired'), token)
const journeySigned = new URL(journeySource, 'https://example.com').searchParams.get('signature')

test('journey images use the same stable source in Chinese and hydrated translations; external images stay direct', () => {
  const renewed = journey('https://example.com/renewed')
  assert.equal(journeyImageSource(renewed, token), journeySource)
  for (const locale of ['en', 'ja']) {
    const translated = { ...journey(undefined), title: locale, image: { source: 'notion-file', description: locale } }
    assert.equal(journeyImageSource(hydrateMedia(translated, renewed), token), journeySource)
  }
  assert.equal(journeyImageSource({ id, image: { source: 'external', url: 'https://example.com/photo' } }, token), undefined)
})

test('journey requests fetch the latest page image without caching the page or redirect', async () => {
  let count = 0
  const client = createNotionClient({ token, fetcher: async (url, init) => {
    assert.equal(url, `https://api.notion.com/v1/pages/${id}`)
    assert.equal(init.cache, 'no-store')
    count++
    return Response.json({ properties: { 图片: { files: [{ file: { url: `https://example.com/fresh-${count}` } }] } } })
  } })
  for (let i = 1; i <= 2; i++) {
    const response = await resolveNotionImage({ id, signed: journeySigned, kind: 'journey', token,
      readPage: (id) => client.page(id, true), readBlock: () => assert.fail('Must read page properties') })
    assert.equal(response.status, 307)
    assert.equal(response.headers.get('location'), `https://example.com/fresh-${i}`)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
  }
})

test('image signatures cannot be reused for a different resource type', async () => {
  for (const [kind, value] of [['journey', signed], ['block', journeySigned], ['unknown', signed]]) {
    const response = await resolveNotionImage({ id, signed: value, kind, token,
      readPage: () => assert.fail('Must reject before reading'), readBlock: () => assert.fail('Must reject before reading') })
    assert.equal(response.status, 404)
  }
})

test('deleted journey pages and removed or external image fields return uncached errors', async () => {
  for (const record of [
    { archived: true, properties: { 图片: { files: [{ file: { url: 'https://example.com/image' } }] } } },
    { properties: { 图片: { files: [] } } },
    { properties: { 图片: { files: [{ external: { url: 'https://example.com/image' } }] } } }
  ]) {
    const response = await resolveNotionImage({ id, signed: journeySigned, kind: 'journey', token, readPage: async () => record })
    assert.equal(response.status, 404)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
  }
})
