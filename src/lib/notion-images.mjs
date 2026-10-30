import { createHmac, timingSafeEqual } from 'node:crypto'

const blockIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const noStore = { 'Cache-Control': 'private, no-store' }

function signature(id, token, kind) {
  return createHmac('sha256', token).update(`notion-image:v1:${kind}:${id}`).digest('hex')
}

function imageSource(id, token, kind) {
  if (!token || !blockIdPattern.test(id)) return undefined
  return `/api/notion-image/${id}?signature=${signature(id, token, kind)}${kind === 'journey' ? '&kind=journey' : ''}`
}

// Sign only images rendered by the site, so the endpoint cannot read arbitrary private blocks.
export function notionImageSource(block, token) {
  if (!block.image?.file?.url) return undefined
  return imageSource(block.id, token, 'block')
}

export function journeyImageSource(entry, token) {
  if (entry.image?.source !== 'notion-file' || !entry.image.url) return undefined
  return imageSource(entry.id, token, 'journey')
}

export async function resolveNotionImage({ id, signed, token, kind = 'block', readBlock, readPage }) {
  if (!token) return new Response(null, { status: 503, headers: noStore })
  if (!['block', 'journey'].includes(kind) || !blockIdPattern.test(id) || !/^[a-f0-9]{64}$/.test(signed || '') ||
      !timingSafeEqual(Buffer.from(signed, 'hex'), Buffer.from(signature(id, token, kind), 'hex'))) {
    return new Response(null, { status: 404, headers: noStore })
  }
  try {
    // Read only the image's block or journey page, independently of the content cache.
    const record = kind === 'journey' ? await readPage(id) : await readBlock(id)
    const file = kind === 'journey'
      ? record.properties?.['图片']?.files?.[0]?.file
      : record.type === 'image' ? record.image?.file : undefined
    if (record.archived || record.in_trash || !file?.url) {
      return new Response(null, { status: 404, headers: noStore })
    }
    const url = new URL(file.url)
    if (url.protocol !== 'https:') return new Response(null, { status: 502, headers: noStore })
    // Never cache a redirect to a temporary URL, including in the visitor's browser.
    return new Response(null, { status: 307, headers: { ...noStore, Location: url.href } })
  } catch {
    return new Response(null, { status: 502, headers: noStore })
  }
}
