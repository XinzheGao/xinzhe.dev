import { getNavigationPage } from './navigation.mjs'

export const NOTION_SOURCE_ENV = Object.freeze({
  thoughts: 'NOTION_THOUGHTS_DATA_SOURCE_ID',
  projects: 'NOTION_PROJECTS_DATA_SOURCE_ID',
  posts: 'NOTION_POSTS_DATA_SOURCE_ID',
  pages: 'NOTION_PAGES_DATA_SOURCE_ID',
  journey: 'NOTION_JOURNEY_DATA_SOURCE_ID'
})

export function getNotionSources(env = process.env) {
  return Object.fromEntries(Object.entries(NOTION_SOURCE_ENV).map(([kind, key]) => [kind, env[key]?.trim()]))
}

export const plainText = (items = []) => items.map((item) => item.plain_text ?? item.text?.content ?? '').join('')
const textProperty = (page, name) => {
  const value = page.properties?.[name]
  if (value?.formula?.type === 'string') return value.formula.string ?? ''
  return plainText(value?.title || value?.rich_text)
}
const statusOf = (page) => page.properties?.['状态']?.status?.name
const isActive = (page) => !page.archived && !page.in_trash
const validSlug = (slug) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
const validDate = (date) => Boolean(date && Number.isFinite(Date.parse(date)))
const futureDate = (date, now) =>
  date.length === 10
    ? date >
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(now)
    : Date.parse(date) > now.getTime()

export function visiblePage(page, preview = false) {
  return (
    isActive(page) &&
    (preview ? ['草稿', '写作中', '待发布', '已发布'].includes(statusOf(page)) : statusOf(page) === '已发布')
  )
}

export function mapPost(page, preview = false, now = new Date()) {
  if (!visiblePage(page, preview)) return undefined
  const slug = textProperty(page, '链接名')
  const title = textProperty(page, '标题')
  const date = page.properties?.['发布日期']?.date?.start
  if (!title || !validSlug(slug)) return undefined
  // Publication dates are explicit. Draft previews can use creation time.
  if (!preview && (!validDate(date) || futureDate(date, now))) return undefined
  return {
    id: page.id,
    title,
    slug,
    date: validDate(date) ? date : page.created_time,
    seo: { title: textProperty(page, 'SEO 标题') || title, description: textProperty(page, '摘要') },
    sys: { firstPublishedAt: date || page.created_time, publishedAt: page.last_edited_time }
  }
}

function uniqueSlugs(items) {
  const seen = new Set()
  for (const item of items) {
    if (seen.has(item.slug)) throw new Error(`Notion 内容存在重复链接名：${item.slug}`)
    seen.add(item.slug)
  }
  return items
}

export function createNotionClient({
  token,
  sources = getNotionSources(),
  fetcher = fetch,
  pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
}) {
  async function request(path, body, preview = false) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetcher(`https://api.notion.com/v1/${path}`, {
        method: body ? 'POST' : 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Notion-Version': '2025-09-03',
          'Content-Type': 'application/json'
        },
        ...(body && { body: JSON.stringify(body) }),
        ...(preview ? { cache: 'no-store' } : { next: { revalidate: 60, tags: ['notion-content'] } })
      })
      if (response.status === 429 && attempt < 2) {
        const seconds = Number(response.headers.get('retry-after')) || 1
        await pause(Math.min(seconds, 10) * 1000)
        continue
      }
      if (!response.ok)
        throw new Error(`Notion 请求失败（HTTP ${response.status}）。请检查集成权限、密钥和数据源配置。`)
      return response.json()
    }
  }

  async function query(source, preview, conditions = []) {
    if (!token) return []
    if (!sources[source]) throw new Error(`${NOTION_SOURCE_ENV[source]} is not configured`)
    const filter = {
      and: [
        ...(preview
          ? [
              {
                or: ['草稿', '写作中', '待发布', '已发布'].map((name) => ({
                  property: '状态',
                  status: { equals: name }
                }))
              }
            ]
          : [{ property: '状态', status: { equals: '已发布' } }]),
        ...conditions
      ]
    }
    const results = []
    let cursor
    do {
      const data = await request(
        `data_sources/${sources[source]}/query`,
        { page_size: 100, filter, ...(cursor && { start_cursor: cursor }) },
        preview
      )
      results.push(...data.results)
      cursor = data.has_more ? data.next_cursor : undefined
      if (data.has_more && !cursor) throw new Error('Notion 分页响应缺少游标')
    } while (cursor)
    return results
  }

  async function blocks(id, preview = false, depth = 0) {
    if (depth > 20) throw new Error('Notion 正文嵌套超过 20 层，请简化页面结构')
    const items = []
    let cursor
    do {
      const params = new URLSearchParams({ page_size: '100', ...(cursor && { start_cursor: cursor }) })
      const data = await request(`blocks/${id}/children?${params}`, undefined, preview)
      for (const block of data.results) {
        items.push({ ...block, children: block.has_children ? await blocks(block.id, preview, depth + 1) : [] })
      }
      cursor = data.has_more ? data.next_cursor : undefined
      if (data.has_more && !cursor) throw new Error('Notion 正文分页响应缺少游标')
    } while (cursor)
    return items
  }

  async function entries(source, preview, slug) {
    if (slug && !validSlug(slug)) return []
    const pages = await query(
      source,
      preview,
      slug ? [{ property: '链接名', formula: { string: { equals: slug } } }] : []
    )
    return uniqueSlugs(pages.map((page) => mapPost(page, preview)).filter(Boolean))
  }

  return {
    async thoughts(preview = false, slug) {
      return entries('thoughts', preview, slug)
    },
    async projects(preview = false, slug) {
      return entries('projects', preview, slug)
    },
    async posts(preview = false, slug) {
      return entries('posts', preview, slug)
    },
    async pages(preview = false, slug) {
      if (slug && !getNavigationPage(slug)) return []
      const entries = await query('pages', preview, slug ? [{ property: '链接名', rich_text: { equals: slug } }] : [])
      return uniqueSlugs(
        entries
          .filter((page) => visiblePage(page, preview))
          .flatMap((page) => {
            const slug = textProperty(page, '链接名')
            const route = getNavigationPage(slug)
            if (!route) return []
            return [
              {
                id: page.id,
                slug,
                defaultDescription: slug === 'home' ? textProperty(page, '全站默认描述') : undefined,
                title: route.label,
                seo: { title: textProperty(page, 'SEO 标题') || route.label, description: textProperty(page, '摘要') },
                sys: { publishedAt: page.last_edited_time }
              }
            ]
          })
      )
    },
    async journey(preview = false, slug) {
      const entries = await query('journey', preview)
      return entries
        .filter((page) => visiblePage(page, preview))
        .flatMap((page) => {
          const date = page.properties?.['日期']?.date?.start
          if (!validDate(date)) return []
          const file = page.properties?.['图片']?.files?.[0]
          return [
            {
              id: page.id,
              slug: `entry-${page.id.toLowerCase().replaceAll('-', '')}`,
              sys: { publishedAt: page.last_edited_time },
              title: textProperty(page, '标题'),
              date,
              description: textProperty(page, '简述'),
              image: file
                ? {
                    url: file.file?.url || file.external?.url,
                    source: file.file ? 'notion-file' : 'external',
                    description: textProperty(page, '图片说明') || file.name
                  }
                : null
            }
          ]
        })
        .filter((entry) => !slug || entry.slug === slug)
        .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    },
    blocks
  }
}
