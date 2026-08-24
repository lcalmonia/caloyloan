import type { Config, Context } from '@netlify/functions'
import { requireBorrowerReadScope } from '../lib/admin-auth.mjs'
import { readBorrowerDataset } from '../lib/loan-data.mjs'

const noStoreHeaders = { 'Cache-Control': 'no-store' }

export default async (request: Request, context: Context) => {
  if (request.method !== 'GET') {
    return new Response(null, { status: 405, headers: { Allow: 'GET', ...noStoreHeaders } })
  }

  const scope = requireBorrowerReadScope(request, context.params.borrowerId)
  if (scope.denial) return scope.denial

  const dataset = await readBorrowerDataset(scope.borrowerId)
  return dataset
    ? Response.json(dataset, { headers: noStoreHeaders })
    : Response.json({ error: 'Borrower not found.' }, { status: 404, headers: noStoreHeaders })
}

export const config: Config = { path: '/api/borrowers/:borrowerId/data' }
