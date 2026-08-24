import type { Config } from '@netlify/functions'
import { deleteBorrowerSession } from '../lib/borrower-auth.mjs'
import { clearBorrowerSessionCookie } from '../lib/borrower-auth-core.mjs'

const headers = { 'Cache-Control': 'no-store' }

export default async (request: Request) => {
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST', ...headers } })
  await deleteBorrowerSession(request)
  return Response.json({ authenticated: false }, { headers: { ...headers, 'Set-Cookie': clearBorrowerSessionCookie() } })
}

export const config: Config = { path: '/api/borrower/auth/logout' }
