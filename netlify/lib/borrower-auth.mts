import { randomUUID } from 'node:crypto'
import { and, eq, gt } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { borrowerAccounts, borrowerSessions, borrowers } from '../../db/schema.js'
import {
  BORROWER_COOKIE_NAME,
  BORROWER_SESSION_SECONDS,
  createBorrowerSessionCookie,
  createSessionToken,
  hashPassword,
  hashSessionToken,
  normalizeEmail,
  readCookie,
  resolveMatchingBorrowerId,
  validatePassword,
  verifyPassword,
} from './borrower-auth-core.mjs'

export type BorrowerIdentity = { accountId: string; borrowerId: string; email: string }

type RegistrationInput = {
  registeredName?: unknown
  registeredPhone?: unknown
  email?: unknown
  password?: unknown
}

type LoginInput = { email?: unknown; password?: unknown }

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim())
}

export async function registerBorrowerAccount(input: RegistrationInput) {
  if (
    !isNonEmptyString(input.registeredName)
    || !isNonEmptyString(input.registeredPhone)
    || !isNonEmptyString(input.email)
    || typeof input.password !== 'string'
    || !validatePassword(input.password)
  ) return false

  const normalizedEmail = normalizeEmail(input.email)
  if (!normalizedEmail.includes('@') || normalizedEmail.length > 320) return false

  const borrowerRows = await db.select({
    id: borrowers.id,
    name: borrowers.name,
    phone: borrowers.phone,
  }).from(borrowers)
  const borrowerId = resolveMatchingBorrowerId(borrowerRows, {
    registeredName: input.registeredName,
    registeredPhone: input.registeredPhone,
  })
  if (!borrowerId) return false

  const passwordHash = await hashPassword(input.password)
  try {
    await db.insert(borrowerAccounts).values({
      id: randomUUID(),
      borrowerId,
      email: input.email.trim(),
      normalizedEmail,
      passwordHash,
      status: 'active',
    })
    return true
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') return false
    throw error
  }
}

export async function loginBorrower(input: LoginInput) {
  const email = typeof input.email === 'string' ? normalizeEmail(input.email) : ''
  const password = typeof input.password === 'string' && input.password.length <= 256 ? input.password : ''
  const accountRows = email
    ? await db.select().from(borrowerAccounts).where(eq(borrowerAccounts.normalizedEmail, email)).limit(1)
    : []
  const account = accountRows[0]
  const passwordValid = await verifyPassword(password, account?.passwordHash)
  if (!account || account.status !== 'active' || !passwordValid) return null

  const token = createSessionToken()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + BORROWER_SESSION_SECONDS * 1000)
  await db.transaction(async (transaction) => {
    await transaction.insert(borrowerSessions).values({
      id: randomUUID(),
      accountId: account.id,
      tokenHash: hashSessionToken(token),
      expiresAt,
      lastSeenAt: now,
    })
    await transaction.update(borrowerAccounts).set({ lastLoginAt: now, updatedAt: now }).where(eq(borrowerAccounts.id, account.id))
  })

  return {
    cookie: createBorrowerSessionCookie(token),
    identity: { accountId: account.id, borrowerId: account.borrowerId, email: account.email } satisfies BorrowerIdentity,
  }
}

export async function getBorrowerIdentity(request: Request): Promise<BorrowerIdentity | null> {
  const token = readCookie(request, BORROWER_COOKIE_NAME)
  if (!token) return null

  const rows = await db.select({
    sessionId: borrowerSessions.id,
    accountId: borrowerAccounts.id,
    borrowerId: borrowerAccounts.borrowerId,
    email: borrowerAccounts.email,
  }).from(borrowerSessions)
    .innerJoin(borrowerAccounts, eq(borrowerSessions.accountId, borrowerAccounts.id))
    .where(and(
      eq(borrowerSessions.tokenHash, hashSessionToken(token)),
      gt(borrowerSessions.expiresAt, new Date()),
      eq(borrowerAccounts.status, 'active'),
    ))
    .limit(1)

  const session = rows[0]
  if (!session) return null
  await db.update(borrowerSessions).set({ lastSeenAt: new Date() }).where(eq(borrowerSessions.id, session.sessionId))
  return { accountId: session.accountId, borrowerId: session.borrowerId, email: session.email }
}

export async function requireBorrowerSession(request: Request) {
  const identity = await getBorrowerIdentity(request)
  return identity
    ? { denial: null, identity }
    : { denial: Response.json({ error: 'Borrower authentication required.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } }), identity: null }
}

export async function deleteBorrowerSession(request: Request) {
  const token = readCookie(request, BORROWER_COOKIE_NAME)
  if (token) await db.delete(borrowerSessions).where(eq(borrowerSessions.tokenHash, hashSessionToken(token)))
}
