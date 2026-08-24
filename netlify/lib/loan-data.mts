import { asc, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { borrowers, company, loans, payments, settings } from '../../db/schema.js'

const SINGLETON_ID = 'default'

export type LoanDataset = {
  company: { name: string; owner: string; phone: string }
  settings: {
    defaultRate: number
    defaultTerm: number
    defaultMethod: string
    defaultFrequency: string
    defaultPenaltyRate: number
    loanCalcVersion: number
  }
  counter: { loan: number }
  borrowers: Array<{ id: string; name: string; phone: string; address: string; notes: string }>
  loans: Array<{
    id: string
    no: string
    borrowerId: string
    borrowerName: string
    principal: number
    rate: number
    term: number
    method: string
    frequency: string
    rateBasis: string
    penaltyRate: number
    penaltyRule: string
    startDate: string
    status: string
    notes: string
  }>
  payments: Array<{
    id: string
    loanId: string
    borrowerId: string
    borrowerName: string
    date: string
    amount: number
    method: string
    note: string
  }>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readString(record: Record<string, unknown>, key: string) {
  if (typeof record[key] !== 'string') throw new Error(`${key} must be a string`)
  return record[key]
}

function readNumber(record: Record<string, unknown>, key: string) {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${key} must be a finite number`)
  return value
}

function readInteger(record: Record<string, unknown>, key: string) {
  const value = readNumber(record, key)
  if (!Number.isInteger(value)) throw new Error(`${key} must be an integer`)
  return value
}

function readDate(record: Record<string, unknown>, key: string) {
  const value = readString(record, key)
  if (Number.isNaN(Date.parse(value))) throw new Error(`${key} must be an ISO date`)
  return value
}

function readObject(record: Record<string, unknown>, key: string) {
  const value = record[key]
  if (!isRecord(value)) throw new Error(`${key} must be an object`)
  return value
}

function readArray(record: Record<string, unknown>, key: string) {
  const value = record[key]
  if (!Array.isArray(value)) throw new Error(`${key} must be an array`)
  return value
}

export function parseLoanDataset(input: unknown): LoanDataset {
  if (!isRecord(input)) throw new Error('Dataset must be an object')

  const companyInput = readObject(input, 'company')
  const settingsInput = readObject(input, 'settings')
  const counterInput = readObject(input, 'counter')
  const borrowerInputs = readArray(input, 'borrowers')
  const loanInputs = readArray(input, 'loans')
  const paymentInputs = readArray(input, 'payments')

  const dataset: LoanDataset = {
    company: {
      name: readString(companyInput, 'name'),
      owner: readString(companyInput, 'owner'),
      phone: readString(companyInput, 'phone'),
    },
    settings: {
      defaultRate: readNumber(settingsInput, 'defaultRate'),
      defaultTerm: readInteger(settingsInput, 'defaultTerm'),
      defaultMethod: readString(settingsInput, 'defaultMethod'),
      defaultFrequency: readString(settingsInput, 'defaultFrequency'),
      defaultPenaltyRate: readNumber(settingsInput, 'defaultPenaltyRate'),
      loanCalcVersion: readInteger(settingsInput, 'loanCalcVersion'),
    },
    counter: { loan: readInteger(counterInput, 'loan') },
    borrowers: borrowerInputs.map((value) => {
      if (!isRecord(value)) throw new Error('Each borrower must be an object')
      return {
        id: readString(value, 'id'),
        name: readString(value, 'name'),
        phone: readString(value, 'phone'),
        address: readString(value, 'address'),
        notes: readString(value, 'notes'),
      }
    }),
    loans: loanInputs.map((value) => {
      if (!isRecord(value)) throw new Error('Each loan must be an object')
      return {
        id: readString(value, 'id'),
        no: readString(value, 'no'),
        borrowerId: readString(value, 'borrowerId'),
        borrowerName: readString(value, 'borrowerName'),
        principal: readNumber(value, 'principal'),
        rate: readNumber(value, 'rate'),
        term: readInteger(value, 'term'),
        method: readString(value, 'method'),
        frequency: readString(value, 'frequency'),
        rateBasis: readString(value, 'rateBasis'),
        penaltyRate: readNumber(value, 'penaltyRate'),
        penaltyRule: readString(value, 'penaltyRule'),
        startDate: readDate(value, 'startDate'),
        status: readString(value, 'status'),
        notes: readString(value, 'notes'),
      }
    }),
    payments: paymentInputs.map((value) => {
      if (!isRecord(value)) throw new Error('Each payment must be an object')
      return {
        id: readString(value, 'id'),
        loanId: readString(value, 'loanId'),
        borrowerId: readString(value, 'borrowerId'),
        borrowerName: readString(value, 'borrowerName'),
        date: readDate(value, 'date'),
        amount: readNumber(value, 'amount'),
        method: readString(value, 'method'),
        note: readString(value, 'note'),
      }
    }),
  }

  const borrowerIds = new Set(dataset.borrowers.map(({ id }) => id))
  const loanBorrowers = new Map(dataset.loans.map((loan) => [loan.id, loan.borrowerId]))
  if (dataset.loans.some((loan) => !borrowerIds.has(loan.borrowerId))) throw new Error('Every loan must reference an included borrower')
  if (dataset.payments.some((payment) => loanBorrowers.get(payment.loanId) !== payment.borrowerId)) {
    throw new Error('Every payment must reference an included loan and its borrower')
  }

  return dataset
}

export async function readAdminDataset(): Promise<{ dataset: LoanDataset; databaseEmpty: boolean }> {
  const [companyRows, settingRows, borrowerRows, loanRows, paymentRows] = await Promise.all([
    db.select().from(company).where(eq(company.id, SINGLETON_ID)).limit(1),
    db.select().from(settings).where(eq(settings.id, SINGLETON_ID)).limit(1),
    db.select().from(borrowers).orderBy(asc(borrowers.createdAt), asc(borrowers.id)),
    db.select().from(loans).orderBy(asc(loans.createdAt), asc(loans.id)),
    db.select().from(payments).orderBy(asc(payments.createdAt), asc(payments.id)),
  ])

  const companyRow = companyRows[0]
  const settingRow = settingRows[0]
  const dataset: LoanDataset = {
    company: companyRow
      ? { name: companyRow.name, owner: companyRow.owner, phone: companyRow.phone }
      : { name: 'JuanLend Financing', owner: 'Admin', phone: '0917 555 0100' },
    settings: settingRow
      ? {
          defaultRate: settingRow.defaultRate,
          defaultTerm: settingRow.defaultTerm,
          defaultMethod: settingRow.defaultMethod,
          defaultFrequency: settingRow.defaultFrequency,
          defaultPenaltyRate: settingRow.defaultPenaltyRate,
          loanCalcVersion: settingRow.loanCalcVersion,
        }
      : {
          defaultRate: 12,
          defaultTerm: 12,
          defaultMethod: 'reducing',
          defaultFrequency: 'monthly',
          defaultPenaltyRate: 0,
          loanCalcVersion: 2,
        },
    counter: { loan: settingRow?.loanCounter ?? 1000 },
    borrowers: borrowerRows.map(({ id, name, phone, address, notes }) => ({ id, name, phone, address, notes })),
    loans: loanRows.map(({ createdAt, updatedAt, ...loan }) => loan),
    payments: paymentRows.map(({ createdAt, updatedAt, ...payment }) => payment),
  }
  return {
    dataset,
    databaseEmpty: !companyRow && !settingRow && !borrowerRows.length && !loanRows.length && !paymentRows.length,
  }
}

export async function replaceAdminDataset(dataset: LoanDataset) {
  await db.transaction(async (transaction) => {
    await transaction.delete(payments)
    await transaction.delete(loans)
    await transaction.delete(borrowers)

    await transaction.insert(company).values({ id: SINGLETON_ID, ...dataset.company }).onConflictDoUpdate({
      target: company.id,
      set: { ...dataset.company, updatedAt: new Date() },
    })
    await transaction.insert(settings).values({
      id: SINGLETON_ID,
      ...dataset.settings,
      loanCounter: dataset.counter.loan,
    }).onConflictDoUpdate({
      target: settings.id,
      set: { ...dataset.settings, loanCounter: dataset.counter.loan, updatedAt: new Date() },
    })

    if (dataset.borrowers.length) await transaction.insert(borrowers).values(dataset.borrowers)
    if (dataset.loans.length) await transaction.insert(loans).values(dataset.loans)
    if (dataset.payments.length) await transaction.insert(payments).values(dataset.payments)
  })
}

export async function readBorrowerDataset(borrowerId: string) {
  const [borrowerRows, loanRows, paymentRows] = await Promise.all([
    db.select().from(borrowers).where(eq(borrowers.id, borrowerId)).limit(1),
    db.select().from(loans).where(eq(loans.borrowerId, borrowerId)),
    db.select().from(payments).where(eq(payments.borrowerId, borrowerId)),
  ])

  const borrower = borrowerRows[0]
  if (!borrower) return null
  const { createdAt, updatedAt, ...borrowerData } = borrower
  return {
    borrower: borrowerData,
    loans: loanRows.map(({ createdAt: _createdAt, updatedAt: _updatedAt, ...loan }) => loan),
    payments: paymentRows.map(({ createdAt: _createdAt, updatedAt: _updatedAt, ...payment }) => payment),
  }
}
