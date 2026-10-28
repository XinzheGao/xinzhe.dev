import test from 'node:test'
import assert from 'node:assert/strict'
import { createNotionClient, mapPost, visiblePage } from '../src/lib/notion-client.mjs'
import { NAVIGATION } from '../src/lib/navigation.mjs'

const rich = (value) => ({ rich_text: [{ type: 'text', text: { content: value } }] })
function page({ slug = 'test-post', status = '已发布', date = '2026-01-01', ...rest } = {}) {
  return {
    id: 'page-1',
    created_time: '2025-12-01T00:00:00Z',
    last_edited_time: '2026-01-02T00:00:00Z',
    properties: {
      标题: { title: [{ plain_text: '示例文章' }] },
      链接名: rich(slug),
      状态: { status: { name: status } },
      发布日期: { date: date ? { start: date } : null }
    },
    ...rest
  }
}
const list = (results, extra = {}) => ({ results, has_more: false, ...extra })
const jsonResponse = (data) => ({ ok: true, status: 200, json: async () => data })

test('navigation contains exactly the six supported destinations, in sidebar order', () => {
  assert.deepEqual(
    NAVIGATION.map((route) => [route.label, route.href]),
    [
      ['首页', '/'],
      ['文章', '/writing'],
      ['作品', '/projects'],
      ['随想', '/thoughts'],
      ['旅程', '/journey'],
      ['关于', '/about']
    ]
  )
})

test('public articles require explicit publication, unique safe slug, and nonfuture date', () => {
  for (const status of ['草稿', '写作中', '待发布', '已归档']) assert.equal(mapPost(page({ status })), undefined)
  for (const date of [null, 'not-a-date', '2999-01-01']) assert.equal(mapPost(page({ date })), undefined)
  assert.equal(mapPost(page({ slug: '../about' })), undefined)
  assert.equal(mapPost(page({ archived: true })), undefined)
  assert.equal(mapPost(page({ in_trash: true })), undefined)
  assert.equal(mapPost(page()).date, '2026-01-01')
})

test('draft preview allows unfinished dates but never archived records', () => {
  assert.equal(mapPost(page({ status: '草稿', date: null }), true).date, '2025-12-01T00:00:00Z')
  assert.equal(visiblePage(page({ status: '已归档' }), true), false)
  assert.equal(visiblePage(page({ archived: true }), true), false)
})

test('date-only publication uses the Shanghai calendar day, including before 08:00', () => {
  const now = new Date('2026-10-26T16:30:00Z')
  assert.equal(mapPost(page({ date: '2026-10-27' }), false, now).date, '2026-10-27')
  assert.equal(mapPost(page({ date: '2026-10-28' }), false, now), undefined)
})

test('missing token renders no remote content and performs no network calls', async () => {
  const client = createNotionClient({ fetcher: () => assert.fail('unexpected network call') })
  assert.deepEqual(await client.posts(), [])
  assert.deepEqual(await client.projects(), [])
  assert.deepEqual(await client.thoughts(), [])
  assert.deepEqual(await client.pages(), [])
  assert.deepEqual(await client.journey(), [])
})

test('queries paginate and use the public server-side filter and configured data source', async () => {
  const calls = []
  const client = createNotionClient({
    token: 'test',
    sources: { posts: 'posts-ds' },
    fetcher: async (url, init) => {
      calls.push({ url, ...init, body: JSON.parse(init.body) })
      return jsonResponse(
        calls.length === 1
          ? list([page()], { has_more: true, next_cursor: 'cursor-2' })
          : list([page({ slug: 'second' })])
      )
    }
  })
  assert.equal((await client.posts()).length, 2)
  assert.equal(calls[0].url, 'https://api.notion.com/v1/data_sources/posts-ds/query')
  assert.deepEqual(calls[0].body.filter.and[0], { property: '状态', status: { equals: '已发布' } })
  assert.equal(calls[1].body.start_cursor, 'cursor-2')
  assert.equal(calls[0].headers['Notion-Version'], '2025-09-03')
})

test('duplicate article slugs fail visibly instead of showing an arbitrary article', async () => {
  const client = createNotionClient({
    token: 'test',
    fetcher: async () => jsonResponse(list([page(), page({ id: 'page-2' })]))
  })
  await assert.rejects(client.posts(), /重复链接名/)
})

test('pages ignore retired routes even if published, and use canonical navigation titles', async () => {
  const client = createNotionClient({
    token: 'test',
    fetcher: async () =>
      jsonResponse(
        list([
          page({ slug: 'about' }),
          page({ slug: 'bookmarks' }),
          page({ slug: 'stack' }),
          page({ slug: 'workspace' }),
          page({ slug: 'home' }),
          page({ slug: 'projects' })
        ])
      )
  })
  assert.deepEqual(
    (await client.pages()).map(({ slug, title }) => [slug, title]),
    [
      ['about', '关于'],
      ['home', '首页'],
      ['projects', '作品']
    ]
  )
  assert.deepEqual(await client.pages(false, 'bookmarks'), [])
})

test('block pagination and nested list content are both retained', async () => {
  const client = createNotionClient({
    token: 'test',
    fetcher: async (url) => {
      if (url.includes('/nested/'))
        return jsonResponse(list([{ id: 'child', type: 'paragraph', paragraph: rich('nested text') }]))
      if (url.includes('start_cursor='))
        return jsonResponse(list([{ id: 'second', type: 'paragraph', paragraph: rich('last') }]))
      return jsonResponse(
        list([{ id: 'nested', type: 'bulleted_list_item', has_children: true }], {
          has_more: true,
          next_cursor: 'next-page'
        })
      )
    }
  })
  const blocks = await client.blocks('root')
  assert.deepEqual(
    blocks.map(({ id }) => id),
    ['nested', 'second']
  )
  assert.equal(blocks[0].children[0].paragraph.rich_text[0].text.content, 'nested text')
})

test('preview disables fetch caching; remote API failures are not replaced by empty lists', async () => {
  const calls = []
  const client = createNotionClient({
    token: 'test',
    fetcher: async (url, init) => {
      calls.push(init)
      return jsonResponse(list([]))
    }
  })
  await client.posts(true)
  assert.equal(calls[0].cache, 'no-store')
  assert.equal(calls[0].next, undefined)
  const failed = createNotionClient({ token: 'test', fetcher: async () => ({ ok: false, status: 403 }) })
  await assert.rejects(failed.posts(), /HTTP 403/)
})

test('rate limiting is retried with bounded backoff', async () => {
  let calls = 0
  const waits = []
  const client = createNotionClient({
    token: 'test',
    pause: async (ms) => waits.push(ms),
    fetcher: async () => {
      calls++
      return calls === 1
        ? { ok: false, status: 429, headers: new Headers({ 'retry-after': '2' }) }
        : jsonResponse(list([]))
    }
  })
  assert.deepEqual(await client.posts(), [])
  assert.deepEqual(waits, [2000])
})

test('journey only includes published dated entries, sorted newest first', async () => {
  const item = (date, status) => {
    const value = page({ status })
    value.properties['日期'] = { date: date ? { start: date } : null }
    return value
  }
  const client = createNotionClient({
    token: 'test',
    fetcher: async () =>
      jsonResponse(list([item('2025-01-01'), item(null), item('2026-01-01'), item('2026-02-01', '草稿')]))
  })
  assert.deepEqual(
    (await client.journey()).map(({ date }) => date),
    ['2026-01-01', '2025-01-01']
  )
})

test('descriptions come from Notion fields and respect publication boundaries', async () => {
  const home = page({ slug: 'home' })
  home.properties['摘要'] = rich('首页摘要')
  home.properties['全站默认描述'] = rich('远程全站描述')
  const writing = page({ slug: 'writing', id: 'writing-page' })
  // A field on a different page must never override the site description.
  writing.properties['全站默认描述'] = rich('不应使用的描述')
  const client = createNotionClient({ token: 'test', fetcher: async () => jsonResponse(list([home, writing])) })
  const pages = await client.pages()
  assert.equal(pages[0].defaultDescription, '远程全站描述')
  assert.equal(pages[0].seo.description, '首页摘要')
  assert.equal(pages[1].defaultDescription, undefined)
  assert.equal(pages[1].seo.description, '')

  home.properties['状态'].status.name = '草稿'
  assert.equal(
    (await client.pages()).some(({ slug }) => slug === 'home'),
    false
  )
  assert.equal((await client.pages(true))[0].defaultDescription, '远程全站描述')

  delete home.properties['全站默认描述']
  assert.equal((await client.pages(true))[0].defaultDescription, '')
})

test('projects use an independent source and enforce publishing and preview rules', async () => {
  const calls = []
  const client = createNotionClient({
    token: 'test',
    sources: { posts: 'articles', projects: 'portfolio' },
    fetcher: async (url, init) => {
      calls.push({ url, ...init, body: JSON.parse(init.body) })
      return jsonResponse(
        list([
          page(),
          page({ slug: 'draft-project', status: '草稿', date: null }),
          page({ slug: 'future-project', date: '2999-01-01' })
        ])
      )
    }
  })
  assert.deepEqual(
    (await client.projects()).map(({ slug }) => slug),
    ['test-post']
  )
  assert.equal(calls[0].url, 'https://api.notion.com/v1/data_sources/portfolio/query')
  assert.deepEqual(calls[0].body.filter.and[0], { property: '状态', status: { equals: '已发布' } })
  assert.equal((await client.projects(true, 'draft-project')).length, 3)
  assert.equal(calls[1].cache, 'no-store')
  assert.deepEqual(calls[1].body.filter.and[1], { property: '链接名', rich_text: { equals: 'draft-project' } })
  assert.deepEqual(await client.projects(false, '../writing'), [])
  await client.posts()
  assert.equal(calls[2].url, 'https://api.notion.com/v1/data_sources/articles/query')
})

test('duplicate project links fail, independently of article links', async () => {
  const client = createNotionClient({
    token: 'test',
    fetcher: async () => jsonResponse(list([page(), page({ id: 'duplicate' })]))
  })
  await assert.rejects(client.projects(), /重复链接名/)
})

test('thoughts use their own source, preserve publication boundaries and support draft detail queries', async () => {
  const calls = []
  const client = createNotionClient({
    token: 'test',
    sources: { thoughts: 'thoughts-ds', posts: 'posts-ds' },
    fetcher: async (url, init) => {
      calls.push({ url, ...init, body: JSON.parse(init.body) })
      return jsonResponse(
        list([
          page(),
          page({ slug: 'draft-thought', status: '草稿', date: null }),
          page({ slug: 'future-thought', date: '2999-01-01' }),
          page({ slug: 'archived-thought', archived: true })
        ])
      )
    }
  })
  assert.deepEqual(
    (await client.thoughts()).map(({ slug }) => slug),
    ['test-post']
  )
  assert.equal(calls[0].url, 'https://api.notion.com/v1/data_sources/thoughts-ds/query')
  assert.deepEqual(calls[0].body.filter.and[0], { property: '状态', status: { equals: '已发布' } })
  assert.deepEqual(
    (await client.thoughts(true, 'draft-thought')).map(({ slug }) => slug),
    ['test-post', 'draft-thought', 'future-thought']
  )
  assert.equal(calls[1].cache, 'no-store')
  assert.deepEqual(calls[1].body.filter.and[1], { property: '链接名', rich_text: { equals: 'draft-thought' } })
  assert.deepEqual(await client.thoughts(false, '../writing'), [])
  await client.posts()
  assert.equal(calls[2].url, 'https://api.notion.com/v1/data_sources/posts-ds/query')
  const duplicate = createNotionClient({
    token: 'test',
    fetcher: async () => jsonResponse(list([page(), page({ id: 'duplicate' })]))
  })
  await assert.rejects(duplicate.thoughts(), /重复链接名/)
})
