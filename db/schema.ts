import { doublePrecision, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

const timestamps = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const company = pgTable('company', {
  id: text().primaryKey(),
  name: text().notNull(),
  owner: text().notNull().default(''),
  phone: text().notNull().default(''),
  ...timestamps(),
})

export const settings = pgTable('settings', {
  id: text().primaryKey(),
  defaultRate: doublePrecision('default_rate').notNull().default(12),
  defaultTerm: integer('default_term').notNull().default(12),
  defaultMethod: text('default_method').notNull().default('reducing'),
  defaultFrequency: text('default_frequency').notNull().default('monthly'),
  defaultPenaltyRate: doublePrecision('default_penalty_rate').notNull().default(0),
  loanCalcVersion: integer('loan_calc_version').notNull().default(2),
  loanCounter: integer('loan_counter').notNull().default(1000),
  ...timestamps(),
})

export const borrowers = pgTable('borrowers', {
  id: text().primaryKey(),
  name: text().notNull(),
  phone: text().notNull().default(''),
  address: text().notNull().default(''),
  notes: text().notNull().default(''),
  ...timestamps(),
})

export const loans = pgTable('loans', {
  id: text().primaryKey(),
  no: text().notNull().unique(),
  borrowerId: text('borrower_id').notNull().references(() => borrowers.id, { onDelete: 'restrict' }),
  borrowerName: text('borrower_name').notNull(),
  principal: doublePrecision().notNull(),
  rate: doublePrecision().notNull(),
  term: integer().notNull(),
  method: text().notNull(),
  frequency: text().notNull().default('monthly'),
  rateBasis: text('rate_basis').notNull().default('annual'),
  penaltyRate: doublePrecision('penalty_rate').notNull().default(0),
  penaltyRule: text('penalty_rule').notNull().default('overdue_balance_weekly'),
  startDate: timestamp('start_date', { withTimezone: true, mode: 'string' }).notNull(),
  status: text().notNull().default('ongoing'),
  notes: text().notNull().default(''),
  ...timestamps(),
})

export const payments = pgTable('payments', {
  id: text().primaryKey(),
  loanId: text('loan_id').notNull().references(() => loans.id, { onDelete: 'cascade' }),
  borrowerId: text('borrower_id').notNull().references(() => borrowers.id, { onDelete: 'restrict' }),
  borrowerName: text('borrower_name').notNull(),
  date: timestamp('date', { withTimezone: true, mode: 'string' }).notNull(),
  amount: doublePrecision().notNull(),
  method: text().notNull(),
  note: text().notNull().default(''),
  ...timestamps(),
})
