import {
  createAdminSessionCookie,
  getAdminCredentials,
  isValidAdminSession,
  validateAdminCredentials,
} from '../lib/admin-auth.mjs'

export default async (request: Request) => {
  const { username: adminUsername, password: adminPassword } = getAdminCredentials()

  if (!adminUsername || !adminPassword) {
    return Response.json({ error: 'Admin login is not configured.' }, { status: 503 })
  }

  if (request.method === 'GET') {
    return isValidAdminSession(request, adminPassword)
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

  if (!validateAdminCredentials(credentials.username || '', credentials.password || '', adminUsername, adminPassword)) {
    return Response.json({ error: 'Invalid username or password.' }, { status: 401 })
  }

  return Response.json(
    { authenticated: true },
    { headers: { 'Set-Cookie': createAdminSessionCookie(adminPassword) } },
  )
}
