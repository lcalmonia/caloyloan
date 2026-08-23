import { createHmac, timingSafeEqual } from 'node:crypto'

const COOKIE_NAME = 'utangtracker_admin_session'
const SESSION_SECONDS = 60 * 60 * 8

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
  const match = cookies.split(';').map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith(`${COOKIE_NAME}=`))
  return match ? decodeURIComponent(match.slice(COOKIE_NAME.length + 1)) : ''
}

function isValidSession(request: Request, password: string) {
  const [expires, signature] = getCookie(request).split('.')
  if (!expires || !signature || Number(expires) <= Date.now()) return false
  return safeEqual(signature, sign(expires, password))
}

export default async (request: Request) => {
  const adminUsername = Netlify.env.get('INITIAL_ADMIN_USERNAME')
  const adminPassword = Netlify.env.get('INITIAL_ADMIN_PASSWORD')

  if (!adminUsername || !adminPassword) {
    return Response.json({ error: 'Admin login is not configured.' }, { status: 503 })
  }

  if (request.method === 'GET') {
    return isValidSession(request, adminPassword)
      ? Response.json({ authenticated: true })
      : Response.json({ authenticated: false }, { status: 401 })
  }

  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { Allow: 'GET, POST' } })
  }

  let credentials: { username?: string; password?: string }
  try {
    credentials = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }

  if (!safeEqual(credentials.username || '', adminUsername) || !safeEqual(credentials.password || '', adminPassword)) {
    return Response.json({ error: 'Invalid username or password.' }, { status: 401 })
  }

  const expires = String(Date.now() + SESSION_SECONDS * 1000)
  const session = `${expires}.${sign(expires, adminPassword)}`
  return Response.json(
    { authenticated: true },
    { headers: { 'Set-Cookie': `${COOKIE_NAME}=${encodeURIComponent(session)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}` } },
  )
}
