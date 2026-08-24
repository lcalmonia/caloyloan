import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  borrowerRequestMatchesIdentity,
  clearBorrowerSessionCookie,
  createBorrowerSessionCookie,
  createSessionToken,
  hashPassword,
  hashSessionToken,
  normalizeName,
  normalizePhone,
  registeredIdentityMatches,
  resolveMatchingBorrowerId,
  verifyPassword,
} from '../netlify/lib/borrower-auth-core.mts'
import { clearAdminSessionCookie, createAdminSessionCookie, validateAdminCredentials } from '../netlify/lib/admin-auth.mts'

test('borrower registration matching normalizes registered identity fields', () => {
  assert.equal(normalizeName('  Maria   Santos '), normalizeName('maria santos'))
  assert.equal(normalizePhone('+63 917-555-0100'), normalizePhone('09175550100'))
  assert.equal(registeredIdentityMatches(
    { name: 'Maria Santos', phone: '+63 917-555-0100' },
    { registeredName: ' maria  santos ', registeredPhone: '0917 555 0100' },
  ), true)
  assert.equal(registeredIdentityMatches(
    { name: 'Maria Santos', phone: '+63 917-555-0100' },
    { registeredName: 'Maria Santos', registeredPhone: '0917 555 0199' },
  ), false)
})

test('borrower registration resolves only one exact normalized borrower match', () => {
  const input = { registeredName: ' maria  santos ', registeredPhone: '0917 555 0100' }
  const matchingBorrower = { id: 'borrower-a', name: 'Maria Santos', phone: '+63 917-555-0100' }
  assert.equal(resolveMatchingBorrowerId([matchingBorrower], input), 'borrower-a')
  assert.equal(resolveMatchingBorrowerId([matchingBorrower], { ...input, registeredPhone: '0917 555 0199' }), null)
  assert.equal(resolveMatchingBorrowerId([
    matchingBorrower,
    { id: 'borrower-b', name: 'MARIA SANTOS', phone: '09175550100' },
  ], input), null)
})

test('password credentials use scrypt and never contain plaintext', async () => {
  const password = 'correct horse battery staple'
  const passwordHash = await hashPassword(password)
  assert.match(passwordHash, /^scrypt\$/)
  assert.equal(passwordHash.includes(password), false)
  assert.equal(await verifyPassword(password, passwordHash), true)
  assert.equal(await verifyPassword('invalid password', passwordHash), false)
})

test('invalid account lookup still performs a password derivation and rejects', async () => {
  assert.equal(await verifyPassword('invalid password'), false)
})

test('borrower sessions use opaque tokens and hardened cookies', () => {
  const token = createSessionToken()
  const tokenHash = hashSessionToken(token)
  const cookie = createBorrowerSessionCookie(token)
  assert.notEqual(tokenHash, token)
  assert.equal(tokenHash.includes(token), false)
  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /Secure/)
  assert.match(cookie, /SameSite=Strict/)
})

test('authorization permits only the session borrower identity', () => {
  assert.equal(borrowerRequestMatchesIdentity('borrower-a'), true)
  assert.equal(borrowerRequestMatchesIdentity('borrower-a', 'borrower-a'), true)
  assert.equal(borrowerRequestMatchesIdentity('borrower-a', 'borrower-b'), false)
})

test('logout expires the borrower cookie immediately', () => {
  assert.match(clearBorrowerSessionCookie(), /Max-Age=0/)
})

test('database migration enforces one account per existing borrower', async () => {
  const migration = await readFile(new URL('../netlify/database/migrations/20260824135356_add_borrower_authentication/migration.sql', import.meta.url), 'utf8')
  assert.match(migration, /UNIQUE INDEX "borrower_accounts_borrower_id_unique"/)
  assert.match(migration, /FOREIGN KEY \("borrower_id"\) REFERENCES "borrowers"\("id"\)/)
  assert.match(migration, /"password_hash" text NOT NULL/)
  assert.doesNotMatch(migration, /"password" text/)
})

test('borrower data endpoint reads using authenticated identity', async () => {
  const source = await readFile(new URL('../netlify/functions/borrower-data.mts', import.meta.url), 'utf8')
  assert.match(source, /readBorrowerDataset\(scope\.identity\.borrowerId\)/)
  assert.doesNotMatch(source, /readBorrowerDataset\(requestedBorrowerId\)/)
  assert.match(source, /status: 403/)
})

test('existing admin credential and cookie behavior remains valid', () => {
  assert.equal(validateAdminCredentials('admin', 'secret', 'admin', 'secret'), true)
  assert.equal(validateAdminCredentials('admin', 'wrong', 'admin', 'secret'), false)
  const cookie = createAdminSessionCookie('secret')
  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /Secure/)
  assert.match(cookie, /SameSite=Strict/)
})

test('admin logout expires the session cookie and returns to login flow', async () => {
  assert.match(clearAdminSessionCookie(), /Max-Age=0/)
  const functionSource = await readFile(new URL('../netlify/functions/admin-login.mts', import.meta.url), 'utf8')
  const interfaceSource = await readFile(new URL('../index.html', import.meta.url), 'utf8')
  assert.match(functionSource, /request\.method === 'DELETE'/)
  assert.match(functionSource, /clearAdminSessionCookie\(\)/)
  assert.match(interfaceSource, /id="adminLogoutButton"[^>]*>Logout<\/button>/)
  assert.match(interfaceSource, /method:'DELETE'/)
  assert.match(interfaceSource, /document\.getElementById\('app'\)\.hidden=true/)
  assert.match(interfaceSource, /document\.getElementById\('authGate'\)\.hidden=false/)
})

test('borrower registration and login entry points use Phase 4A APIs only', async () => {
  const source = await readFile(new URL('../index.html', import.meta.url), 'utf8')
  assert.match(source, /id="borrowerLoginForm"/)
  assert.match(source, /id="borrowerRegisterForm"/)
  assert.match(source, />Borrower Login<\/button>/)
  assert.match(source, />Register as Borrower<\/button>/)
  assert.match(source, /fetch\('\/api\/borrower\/auth\/register'/)
  assert.doesNotMatch(source, /borrowerRegisterId/)
  assert.doesNotMatch(source, />Borrower ID<\/label>/)
  assert.match(source, /registeredName:document\.getElementById\('borrowerRegisterName'\)/)
  assert.match(source, /registeredPhone:document\.getElementById\('borrowerRegisterPhone'\)/)
  assert.match(source, /fetch\('\/api\/borrower\/auth\/login'/)
  assert.match(source, /fetch\('\/api\/borrower\/auth\/session'/)
  assert.match(source, /fetch\('\/api\/borrower\/auth\/logout'/)
  assert.doesNotMatch(source, /fetch\('\/api\/borrower\/data'/)
})

test('borrower UI keeps generic invalid and duplicate registration rejection', async () => {
  const interfaceSource = await readFile(new URL('../index.html', import.meta.url), 'utf8')
  const registrationSource = await readFile(new URL('../netlify/functions/borrower-register.mts', import.meta.url), 'utf8')
  const authenticationSource = await readFile(new URL('../netlify/lib/borrower-auth.mts', import.meta.url), 'utf8')
  assert.match(interfaceSource, /Unable to create an account with the provided borrower information\./)
  assert.match(registrationSource, /return registered\s+\?/)
  assert.match(registrationSource, /status: 201/)
  assert.match(registrationSource, /status: 400/)
  assert.match(registrationSource, /Unable to create borrower account with the provided information\./)
  assert.match(authenticationSource, /from\(borrowers\)/)
  assert.match(authenticationSource, /resolveMatchingBorrowerId\(borrowerRows/)
  assert.match(authenticationSource, /if \(!borrowerId\) return false/)
  assert.match(authenticationSource, /db\.insert\(borrowerAccounts\)/)
  assert.match(authenticationSource, /borrowerId,\n/)
  assert.doesNotMatch(authenticationSource, /insert\(borrowers\)/)
  assert.match(authenticationSource, /error\.code === '23505'/)
})

test('admin login submission remains connected to the existing endpoint', async () => {
  const source = await readFile(new URL('../index.html', import.meta.url), 'utf8')
  assert.match(source, /id="adminLoginForm"/)
  assert.match(source, /fetch\('\/.netlify\/functions\/admin-login',\{method:'POST'/)
  assert.match(source, /username:document\.getElementById\('adminUsername'\)\.value/)
  assert.match(source, /password:document\.getElementById\('adminPassword'\)\.value/)
})
