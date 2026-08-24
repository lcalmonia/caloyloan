import { createHmac, timingSafeEqual } from 'node:crypto'

export const ADMIN_COOKIE_NAME = 'utangtracker_admin_session'
export const ADMIN_SESSION_SECONDS = 60 * 60 * 8

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

function sign(expires: string, password: string) {
  return createHmac('sha256', password).update(`admin:${expires}`).digest('base64url')
}

function getCookie(request: Request) {
  const cookies = request.headers.get('cookie') || ''
  const match = cookies.split(';').map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith(`${ADMIN_COOKIE_NAME}=`))
  return match ? decodeURIComponent(match.slice(ADMIN_COOKIE_NAME.length + 1)) : ''
}

export function getAdminCredentials() {
  return {
    username: Netlify.env.get('INITIAL_ADMIN_USERNAME'),
    password: Netlify.env.get('INITIAL_ADMIN_PASSWORD'),
  }
}

export function validateAdminCredentials(username: string, password: string, expectedUsername: string, expectedPassword: string) {
  return safeEqual(username, expectedUsername) && safeEqual(password, expectedPassword)
}

export function isValidAdminSession(request: Request, password: string) {
  const [expires, signature] = getCookie(request).split('.')
  if (!expires || !signature || Number(expires) <= Date.now()) return false
  return safeEqual(signature, sign(expires, password))
}

export function requireAdminSession(request: Request) {
  const { password } = getAdminCredentials()
  if (!password) return Response.json({ error: 'Admin login is not configured.' }, { status: 503 })
  if (!isValidAdminSession(request, password)) return Response.json({ error: 'Admin authentication required.' }, { status: 401 })
  return null
}

export function createAdminSessionCookie(password: string) {
  const expires = String(Date.now() + ADMIN_SESSION_SECONDS * 1000)
  const session = `${expires}.${sign(expires, password)}`
  return `${ADMIN_COOKIE_NAME}=${encodeURIComponent(session)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${ADMIN_SESSION_SECONDS}`
}

export function clearAdminSessionCookie() {
  return `${ADMIN_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
}

export function requireBorrowerReadScope(request: Request, borrowerId: string) {
  const denial = requireAdminSession(request)
  return denial ? { denial, borrowerId: null } : { denial: null, borrowerId }
}
