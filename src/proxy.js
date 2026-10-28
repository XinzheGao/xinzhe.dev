import { NextResponse } from 'next/server'
import { splitLocale } from '@/lib/locale-routing.mjs'

export function proxy(request, event) {
  const { locale, pathname } = splitLocale(request.nextUrl.pathname)
  const requestHeaders = new Headers(request.headers)
  // Always overwrite caller-supplied headers. URL, never a cookie, determines content language.
  requestHeaders.set('x-site-locale', locale)
  if (request.nextUrl.pathname === '/zh-CN' || request.nextUrl.pathname.startsWith('/zh-CN/')) {
    const canonical = new URL(request.url)
    canonical.pathname = pathname
    return NextResponse.redirect(canonical, 308)
  }
  const writingSlug = pathname.match(/\/writing\/(.*)/)?.[1]

  async function sendAnalytics() {
    if (!writingSlug || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return

    const url = new URL('/api/increment-views', request.url)
    url.searchParams.set('slug', writingSlug)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (res.status !== 200) console.error('Failed to send analytics', res)
    } catch (error) {
      console.error('Error sending analytics', error)
    }
  }

  if (writingSlug) event.waitUntil(sendAnalytics())
  if (pathname !== request.nextUrl.pathname) {
    const destination = new URL(request.url)
    destination.pathname = pathname
    return NextResponse.rewrite(destination, { request: { headers: requestHeaders } })
  }
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: '/((?!api|_next|assets|.*\\.).*)'
}
