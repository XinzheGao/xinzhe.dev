import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE = 'translation-admin-session'
export const SESSION_SECONDS = 8 * 60 * 60
export const passwordConfigured = (secret) => typeof secret === 'string' && secret.length >= 24
const digest = (text) => createHash('sha256').update(text).digest()
export function passwordMatches(input, secret) {
  return (
    passwordConfigured(secret) &&
    typeof input === 'string' &&
    input.length <= 512 &&
    timingSafeEqual(digest(input), digest(secret))
  )
}
export function createSession(secret, now = Date.now()) {
  if (!passwordConfigured(secret)) throw new Error('Admin secret must contain at least 24 characters')
  const payload = Buffer.from(
    JSON.stringify({ exp: now + SESSION_SECONDS * 1000, nonce: randomBytes(16).toString('hex') })
  ).toString('base64url')
  return `${payload}.${createHmac('sha256', secret).update(`translation-admin:${payload}`).digest('base64url')}`
}
export function verifySession(token, secret, now = Date.now()) {
  if (!passwordConfigured(secret) || typeof token !== 'string' || token.length > 1024) return false
  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra) return false
  const expected = createHmac('sha256', secret).update(`translation-admin:${payload}`).digest('base64url')
  if (!timingSafeEqual(digest(signature), digest(expected))) return false
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return Number.isFinite(exp) && exp > now && exp <= now + SESSION_SECONDS * 1000
  } catch {
    return false
  }
}
export function sameOrigin(request) {
  try {
    const origin = new URL(request.headers.get('origin'))
    return origin.host === request.headers.get('host') && ['https:', 'http:'].includes(origin.protocol)
  } catch {
    return false
  }
}
