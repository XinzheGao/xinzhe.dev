import { NextResponse } from 'next/server'
import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'

export async function GET(request) {
  const searchParams = request.nextUrl.searchParams
  const secret = searchParams.get('secret')

  if (!process.env.NOTION_PREVIEW_SECRET || secret !== process.env.NOTION_PREVIEW_SECRET) {
    return NextResponse.json({ error: '无效的访问令牌' }, { status: 401 })
  }

  const slug = searchParams.get('slug') || '/'
  if (!slug.startsWith('/') || slug.startsWith('//') || slug.includes('\\')) {
    return NextResponse.json({ error: '无效的预览路径' }, { status: 400 })
  }
  const draft = await draftMode()
  draft.enable()
  redirect(slug)
}
