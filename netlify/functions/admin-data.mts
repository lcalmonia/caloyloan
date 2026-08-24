import type { Config } from '@netlify/functions'
import { requireAdminSession } from '../lib/admin-auth.mjs'
import { parseLoanDataset, readAdminDataset, replaceAdminDataset } from '../lib/loan-data.mjs'

const noStoreHeaders = { 'Cache-Control': 'no-store' }

export default async (request: Request) => {
  const denial = requireAdminSession(request)
  if (denial) return denial

  if (request.method === 'GET') {
    return Response.json(await readAdminDataset(), { headers: noStoreHeaders })
  }

  if (request.method === 'PUT') {
    let dataset
    try {
      dataset = parseLoanDataset(await request.json())
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid dataset'
      return Response.json({ error: message }, { status: 400, headers: noStoreHeaders })
    }

    await replaceAdminDataset(dataset)
    return Response.json({ saved: true }, { headers: noStoreHeaders })
  }

  return new Response(null, { status: 405, headers: { Allow: 'GET, PUT', ...noStoreHeaders } })
}

export const config: Config = { path: '/api/admin/data' }
