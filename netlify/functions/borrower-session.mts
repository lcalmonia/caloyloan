import type { Config } from '@netlify/functions'
import { getBorrowerIdentity } from '../lib/borrower-auth.mjs'

const headers = { 'Cache-Control': 'no-store' }

export default async (request: Request) => {
  if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET', ...headers } })
  const identity = await getBorrowerIdentity(request)
  return identity
    ? Response.json({ authenticated: true, email: identity.email }, { headers })
    : Response.json({ authenticated: false }, { status: 401, headers })
}

export const config: Config = { path: '/api/borrower/auth/session' }
