import type { Config } from '@netlify/functions'
import { loginBorrower } from '../lib/borrower-auth.mjs'

const headers = { 'Cache-Control': 'no-store' }

export default async (request: Request) => {
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST', ...headers } })

  let input: unknown
  try {
    input = await request.json()
  } catch {
    return Response.json({ error: 'Invalid email or password.' }, { status: 401, headers })
  }

  const login = await loginBorrower(typeof input === 'object' && input ? input : {})
  return login
    ? Response.json({ authenticated: true }, { headers: { ...headers, 'Set-Cookie': login.cookie } })
    : Response.json({ error: 'Invalid email or password.' }, { status: 401, headers })
}

export const config: Config = { path: '/api/borrower/auth/login' }
