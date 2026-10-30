import { createNotionClient } from '@/lib/notion-client.mjs'
import { resolveNotionImage } from '@/lib/notion-images.mjs'

export async function GET(request, { params }) {
  const { id } = await params
  const token = process.env.NOTION_API_TOKEN
  const client = createNotionClient({ token })
  const query = new URL(request.url).searchParams
  return resolveNotionImage({
    id,
    signed: query.get('signature'),
    kind: query.get('kind') ?? 'block',
    token,
    readBlock: (blockId) => client.block(blockId, true),
    readPage: (pageId) => client.page(pageId, true)
  })
}
