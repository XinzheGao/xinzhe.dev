import { NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'

export const runtime = 'nodejs'

export async function GET(request) {
  const searchParams = request.nextUrl.searchParams
  const secret = searchParams.get('secret')

  if (!process.env.NEXT_REVALIDATE_SECRET || secret !== process.env.NEXT_REVALIDATE_SECRET) {
    return NextResponse.json({ error: '无效的访问令牌' }, { status: 401 })
  }

  const path = searchParams.get('path') || '/'
  revalidatePath(path)
  revalidateTag('notion-content', { expire: 0 })
  return NextResponse.json(
    { revalidated: true, message: `页面 ${path} 的缓存已更新`, now: Date.now() },
    { status: 200 }
  )
}
