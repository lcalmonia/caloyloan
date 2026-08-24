import type { Config, Context } from '@netlify/functions'
import { requireBorrowerSession } from '../lib/borrower-auth.mjs'
import { borrowerRequestMatchesIdentity } from '../lib/borrower-auth-core.mjs'
import { readBorrowerDataset } from '../lib/loan-data.mjs'

const noStoreHeaders = { 'Cache-Control': 'no-store' }

export default async (request: Request, context: Context) => {
  if (request.method !== 'GET') {
    return new Response(null, { status: 405, headers: { Allow: 'GET', ...noStoreHeaders } })
  }

  const scope = await requireBorrowerSession(request)
  if (scope.denial) return scope.denial
  const requestedBorrowerId = context.params.borrowerId
  if (!borrowerRequestMatchesIdentity(scope.identity.borrowerId, requestedBorrowerId)) {
    return Response.json({ error: 'Forbidden.' }, { status: 403, headers: noStoreHeaders })
  }

  const dataset = await readBorrowerDataset(scope.identity.borrowerId)
  return dataset
    ? Response.json(dataset, { headers: noStoreHeaders })
    : Response.json({ error: 'Borrower not found.' }, { status: 404, headers: noStoreHeaders })
}

export const config: Config = { path: ['/api/borrower/data', '/api/borrowers/:borrowerId/data'] }
