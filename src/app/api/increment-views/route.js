import { NextResponse } from 'next/server'

import supabase from '@/lib/supabase/private'

export const runtime = 'nodejs'

export async function POST(request) {
  const searchParams = request.nextUrl.searchParams
  const slug = searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: '缺少文章标识' }, { status: 400 })
  if (!supabase) return NextResponse.json({ error: '阅读统计尚未配置' }, { status: 503 })

  try {
    const { error } = await supabase.rpc('increment_view_count', { page_slug: slug })
    if (error) throw error
    return NextResponse.json({ messsage: `文章 ${slug} 的阅读次数已更新` }, { status: 200 })
  } catch (error) {
    console.error('Error incrementing view count:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
