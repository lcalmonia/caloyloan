import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto'
const SCRYPT_COST = 16_384
const SCRYPT_BLOCK_SIZE = 8
const SCRYPT_PARALLELIZATION = 1
const SCRYPT_KEY_LENGTH = 64
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024

export const BORROWER_COOKIE_NAME = 'lendsync_borrower_session'
export const BORROWER_SESSION_SECONDS = 60 * 60 * 12

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en')
}

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits.startsWith('63') && digits.length === 12 ? `0${digits.slice(2)}` : digits
}

export function validatePassword(password: string) {
  return password.length >= 12 && password.length <= 256
}

export function registeredIdentityMatches(
  borrower: { name: string; phone: string },
  input: { registeredName: string; registeredPhone: string },
) {
  const storedPhone = normalizePhone(borrower.phone)
  return normalizeName(borrower.name) === normalizeName(input.registeredName)
    && Boolean(storedPhone)
    && storedPhone === normalizePhone(input.registeredPhone)
}

export function resolveMatchingBorrowerId(
  borrowerRows: Array<{ id: string; name: string; phone: string }>,
  input: { registeredName: string; registeredPhone: string },
) {
  const matches = borrowerRows.filter((borrower) => registeredIdentityMatches(borrower, input))
  return matches.length === 1 ? matches[0].id : null
}

async function derivePassword(password: string, salt: Buffer, cost = SCRYPT_COST, blockSize = SCRYPT_BLOCK_SIZE, parallelization = SCRYPT_PARALLELIZATION) {
  return new Promise<Buffer>((resolve, reject) => {
    nodeScrypt(password, salt, SCRYPT_KEY_LENGTH, {
      N: cost,
      r: blockSize,
      p: parallelization,
      maxmem: SCRYPT_MAX_MEMORY,
    }, (error, derivedKey) => error ? reject(error) : resolve(Buffer.from(derivedKey)))
  })
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const derived = await derivePassword(password, salt)
  return ['scrypt', SCRYPT_COST, SCRYPT_BLOCK_SIZE, SCRYPT_PARALLELIZATION, salt.toString('base64url'), derived.toString('base64url')].join('$')
}

export async function verifyPassword(password: string, encodedHash?: string) {
  if (!encodedHash) {
    await derivePassword(password, Buffer.alloc(16))
    return false
  }

  const [algorithm, costValue, blockSizeValue, parallelizationValue, saltValue, hashValue] = encodedHash.split('$')
  const cost = Number(costValue)
  const blockSize = Number(blockSizeValue)
  const parallelization = Number(parallelizationValue)
  if (algorithm !== 'scrypt' || !cost || !blockSize || !parallelization || !saltValue || !hashValue) return false

  try {
    const expected = Buffer.from(hashValue, 'base64url')
    const actual = await derivePassword(password, Buffer.from(saltValue, 'base64url'), cost, blockSize, parallelization)
    return expected.length === actual.length && timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}

export function createSessionToken() {
  return randomBytes(32).toString('base64url')
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('base64url')
}

export function readCookie(request: Request, name: string) {
  const cookies = request.headers.get('cookie') || ''
  const match = cookies.split(';').map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : ''
}

export function createBorrowerSessionCookie(token: string) {
  return `${BORROWER_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${BORROWER_SESSION_SECONDS}`
}

export function clearBorrowerSessionCookie() {
  return `${BORROWER_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
}

export function borrowerRequestMatchesIdentity(authenticatedBorrowerId: string, requestedBorrowerId?: string) {
  return !requestedBorrowerId || requestedBorrowerId === authenticatedBorrowerId
}
