import { cookies } from 'next/headers'
import { authenticated, failure, json, jsonBody } from '@/lib/translation-admin/http'
import { AdminError } from '@/lib/translation-admin/model.mjs'
import {
  createSession,
  passwordConfigured,
  passwordMatches,
  sameOrigin,
  SESSION_COOKIE,
  SESSION_SECONDS
} from '@/lib/translation-admin/security.mjs'

export const runtime = 'nodejs'
export async function GET() {
  return json({
    authenticated: await authenticated(),
    configured: passwordConfigured(process.env.TRANSLATION_ADMIN_PASSWORD)
  })
}
export async function POST(request) {
  try {
    if (!sameOrigin(request)) throw new AdminError(403, '请求来源无效。')
    const secret = process.env.TRANSLATION_ADMIN_PASSWORD
    if (!passwordConfigured(secret)) throw new AdminError(503, '请先配置至少 24 位的专用管理口令。')
    const { password } = await jsonBody(request)
    if (!passwordMatches(password, secret)) {
      await new Promise((resolve) => setTimeout(resolve, 400))
      throw new AdminError(401, '管理口令不正确。')
    }
    ;(await cookies()).set(SESSION_COOKIE, createSession(secret), {
      httpOnly: true,
      sameSite: 'strict',
      secure: Boolean(process.env.VERCEL) || new URL(request.url).protocol === 'https:',
      path: '/',
      maxAge: SESSION_SECONDS
    })
    return json({ authenticated: true })
  } catch (error) {
    return failure(error)
  }
}
export async function DELETE(request) {
  try {
    if (!sameOrigin(request)) throw new AdminError(403, '请求来源无效。')
    ;(await cookies()).delete(SESSION_COOKIE)
    return json({ authenticated: false })
  } catch (error) {
    return failure(error)
  }
}
