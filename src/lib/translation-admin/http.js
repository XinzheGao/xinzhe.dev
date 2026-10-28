import 'server-only'
import { cookies } from 'next/headers'
import { AdminError } from './model.mjs'
import { passwordConfigured, sameOrigin, SESSION_COOKIE, verifySession } from './security.mjs'

export const privateHeaders = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' }
export async function authenticated() {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value, process.env.TRANSLATION_ADMIN_PASSWORD)
}
export async function protect(request, mutation = false) {
  if (!passwordConfigured(process.env.TRANSLATION_ADMIN_PASSWORD))
    throw new AdminError(503, '请配置至少 24 位的专用管理口令。')
  if (mutation && !sameOrigin(request)) throw new AdminError(403, '请求来源无效，请从管理页面操作。')
  if (!(await authenticated())) throw new AdminError(401, '登录已失效，请重新登录。')
}
export async function jsonBody(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new AdminError(415, '需要 JSON 请求。')
  const reader = request.body?.getReader()
  if (!reader) throw new AdminError(400, '缺少请求内容。')
  const chunks = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > 64 * 1024) {
      await reader.cancel()
      throw new AdminError(413, '内容过长，请分段保存。')
    }
    chunks.push(Buffer.from(value))
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid body')
    return value
  } catch {
    throw new AdminError(400, '请求格式无效。')
  }
}
export function json(value, status = 200) {
  return Response.json(value, { status, headers: privateHeaders })
}
export function failure(error) {
  return json(
    { error: error instanceof AdminError ? error.message : '操作失败，请检查服务端连接或任务日志后重试。' },
    error instanceof AdminError ? error.status : 500
  )
}
