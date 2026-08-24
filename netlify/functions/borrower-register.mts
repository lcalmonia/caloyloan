import type { Config } from '@netlify/functions'
import { registerBorrowerAccount } from '../lib/borrower-auth.mjs'

const headers = { 'Cache-Control': 'no-store' }

export default async (request: Request) => {
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST', ...headers } })

  let input: unknown
  try {
    input = await request.json()
  } catch {
    return Response.json({ error: 'Unable to create borrower account with the provided information.' }, { status: 400, headers })
  }

  const registered = await registerBorrowerAccount(typeof input === 'object' && input ? input : {})
  return registered
    ? Response.json({ registered: true }, { status: 201, headers })
    : Response.json({ error: 'Unable to create borrower account with the provided information.' }, { status: 400, headers })
}

export const config: Config = { path: '/api/borrower/auth/register' }
