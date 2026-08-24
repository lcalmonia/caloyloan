import { createHash } from 'node:crypto'
import type { Config } from '@netlify/functions'
import { requireAdminSession } from '../lib/admin-auth.mjs'
import { parseLoanDataset, readAdminDataset, replaceAdminDataset } from '../lib/loan-data.mjs'

const noStoreHeaders = { 'Cache-Control': 'no-store' }
function datasetEtag(dataset: unknown) {
  const canonical = structuredClone(dataset) as Record<string, unknown>
  for (const key of ['borrowers', 'loans', 'payments']) {
    const rows = canonical[key]
    if (Array.isArray(rows)) rows.sort((left, right) => String(left.id).localeCompare(String(right.id)))
  }
  return `"${createHash('sha256').update(JSON.stringify(canonical)).digest('base64url')}"`
}

export default async (request: Request) => {
  const denial = requireAdminSession(request)
  if (denial) return denial

  if (request.method === 'GET') {
    const { dataset, databaseEmpty } = await readAdminDataset()
    return Response.json(dataset, {
      headers: { ...noStoreHeaders, ETag: datasetEtag(dataset), 'X-LendSync-Database-Empty': String(databaseEmpty) },
    })
  }

  if (request.method === 'PUT') {
    const requireEmpty = request.headers.get('X-LendSync-Require-Empty') === 'true'
    const expectedEtag = request.headers.get('If-Match')
    if (requireEmpty || expectedEtag) {
      const current = await readAdminDataset()
      if (requireEmpty && !current.databaseEmpty) {
        return Response.json({ error: 'The centralized database already contains data.' }, { status: 409, headers: noStoreHeaders })
      }
      if (expectedEtag && expectedEtag !== datasetEtag(current.dataset)) {
        return Response.json({ error: 'Centralized data changed on another Admin device. Refresh and try again.' }, { status: 409, headers: noStoreHeaders })
      }
    }

    let dataset
    try {
      dataset = parseLoanDataset(await request.json())
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid dataset'
      return Response.json({ error: message }, { status: 400, headers: noStoreHeaders })
    }

    await replaceAdminDataset(dataset)
    return Response.json({ saved: true }, { headers: { ...noStoreHeaders, ETag: datasetEtag(dataset) } })
  }

  return new Response(null, { status: 405, headers: { Allow: 'GET, PUT', ...noStoreHeaders } })
}

export const config: Config = { path: '/api/admin/data' }
