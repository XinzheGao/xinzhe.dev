import { NextResponse } from 'next/server'
import { draftMode } from 'next/headers'

export async function GET(request) {
  const searchParams = request.nextUrl.searchParams
  const secret = searchParams.get('secret')

  if (!process.env.NOTION_PREVIEW_SECRET || secret !== process.env.NOTION_PREVIEW_SECRET) {
    return NextResponse.json({ error: '无效的访问令牌' }, { status: 401 })
  }

  const draft = await draftMode()
  draft.disable()
  return NextResponse.json({ messsage: '已退出草稿预览', now: Date.now() }, { status: 200 })
}
