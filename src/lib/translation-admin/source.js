import 'server-only'
import { createNotionClient, NOTION_SOURCES } from '../notion-client.mjs'
import { AdminError } from './model.mjs'

const client = createNotionClient({
  token: process.env.NOTION_API_TOKEN,
  sources: Object.fromEntries(
    Object.entries(NOTION_SOURCES).map(([key, value]) => [
      key,
      process.env[`NOTION_${key.toUpperCase()}_DATA_SOURCE_ID`] || value
    ])
  ),
  fetcher: (url, options) => fetch(url, { ...options, cache: 'no-store', next: undefined })
})
export async function listSources(kind) {
  if (!['posts', 'pages', 'projects', 'thoughts', 'journey'].includes(kind)) throw new AdminError(400, '内容类型无效。')
  if (!process.env.NOTION_API_TOKEN) throw new AdminError(503, '尚未配置 Notion 连接。')
  return client[kind](false)
}
export async function readSource(kind, slug) {
  if (!['posts', 'pages', 'projects', 'thoughts', 'journey'].includes(kind)) throw new AdminError(400, '内容类型无效。')
  const [source] = await client[kind](false, slug)
  if (!source) throw new AdminError(404, '未找到已发布的中文原文。')
  const document =
    kind === 'journey' ? source : { ...source, content: { blocks: await client.blocks(source.id, true) } }
  const [latest] = await client[kind](false, slug)
  if (!latest || latest.sys.publishedAt !== source.sys.publishedAt)
    throw new AdminError(409, '原文刚刚发生变化，请重新加载。')
  return document
}
