import 'server-only'
import type { Transaction } from 'sequelize'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import ExpenseSchedule from './expense-schedule.model'
import Expense from './expense.model'
import type {
  ExpenseScheduleInput,
  ExpenseScheduleUpdateInput,
  ExpenseScheduleQuery,
} from './expense-schedule.schema'
import { nextExpenseDocNumber, calcExpenseTotals, advanceNextRunDate } from './expenses.utils'
import { ensureExpensesBranchAssociations } from './expenses-branch-associations'
import type { IvaRate } from '@/types'

export async function listExpenseSchedules(query: ExpenseScheduleQuery, orgId: string) {
  ensureExpensesBranchAssociations()

  const { page, limit, contact_id, is_active } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = { org_id: orgId }
  if (contact_id) where.contact_id = contact_id
  if (is_active !== undefined) where.is_active = is_active

  const { default: Branch }  = await import('@/modules/auth/branch.model')
  const { default: Contact } = await import('@/modules/contacts/contact.model')

  const { rows, count } = await ExpenseSchedule.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'DESC']],
    include: [
      { model: Branch,  as: 'branch',  attributes: ['id', 'name', 'branch_code'] },
      { model: Contact, as: 'contact', attributes: ['id', 'legal_name', 'trade_name'], required: false },
    ],
  })

  return toPaginated(rows, count, page, limit)
}

export async function getExpenseSchedule(id: string, orgId: string) {
  ensureExpensesBranchAssociations()

  const { default: Branch }  = await import('@/modules/auth/branch.model')
  const { default: Contact } = await import('@/modules/contacts/contact.model')

  const schedule = await ExpenseSchedule.findOne({
    where: { id, org_id: orgId },
    include: [
      { model: Branch,  as: 'branch',  attributes: ['id', 'name', 'branch_code'] },
      { model: Contact, as: 'contact', attributes: ['id', 'legal_name', 'trade_name'], required: false },
    ],
  })
  if (!schedule) throw new Error('EXPENSE_SCHEDULE_NOT_FOUND')
  return schedule
}

export async function createExpenseSchedule(
  input: ExpenseScheduleInput,
  orgId: string,
  actorId: string,
  t?: Transaction,
) {
  const schedule = await ExpenseSchedule.create(
    {
      ...input,
      kind:           'recurring',
      default_amount: String(input.default_amount),
      org_id:         orgId,
      created_by:     actorId,
      updated_by:     actorId,
    },
    { transaction: t },
  )
  logger.info({ scheduleId: schedule.id, orgId }, 'expense schedule created')
  return schedule
}

export async function updateExpenseSchedule(
  id: string,
  input: ExpenseScheduleUpdateInput,
  orgId: string,
  actorId: string,
) {
  const schedule = await ExpenseSchedule.findOne({ where: { id, org_id: orgId } })
  if (!schedule) throw new Error('EXPENSE_SCHEDULE_NOT_FOUND')

  const { default_amount, ...rest } = input
  await schedule.update({
    ...rest,
    ...(default_amount !== undefined ? { default_amount: String(default_amount) } : {}),
    updated_by: actorId,
  })
  return schedule
}

export async function deleteExpenseSchedule(id: string, orgId: string, actorId: string) {
  const schedule = await ExpenseSchedule.findOne({ where: { id, org_id: orgId } })
  if (!schedule) throw new Error('EXPENSE_SCHEDULE_NOT_FOUND')

  await schedule.update({ deleted_by: actorId })
  await schedule.destroy()
}

/**
 * Finds every active schedule due to generate (`next_run_date <= now`) for the
 * given org (optionally scoped to one branch), used by the recurring-expense
 * automation action.
 */
export async function findDueExpenseSchedules(
  orgId: string,
  branchId: string | null,
  now: Date,
): Promise<ExpenseSchedule[]> {
  const { Op } = await import('sequelize')
  const where: Record<string, unknown> = {
    org_id: orgId,
    is_active: true,
    kind: 'recurring',
    next_run_date: { [Op.lte]: now },
  }
  if (branchId) where.branch_id = branchId

  return ExpenseSchedule.findAll({ where, limit: 500 })
}

/**
 * Generates a draft occurrence from a recurring schedule and advances
 * `next_run_date`. Runs inside the caller's transaction.
 */
export async function generateExpenseFromSchedule(
  schedule: ExpenseSchedule,
  orgId: string,
  t: Transaction,
): Promise<Expense> {
  const docNumber = await nextExpenseDocNumber(orgId, schedule.branch_id, 'expense', t)
  const totals = calcExpenseTotals(schedule.default_amount, '0.00', schedule.iva_rate as IvaRate)

  const now = new Date()
  const expense = await Expense.create(
    {
      org_id:               orgId,
      branch_id:            schedule.branch_id,
      contact_id:           schedule.contact_id,
      schedule_id:          schedule.id,
      kind:                 'recurring_occurrence',
      expense_number:       docNumber,
      description:          schedule.description,
      expense_account_code: schedule.expense_account_code,
      iva_rate:             schedule.iva_rate as IvaRate,
      status:               'draft',
      invoice_date:         now,
      due_date:             now,
      paid_amount:          '0.00',
      balance:              totals.total,
      ...totals,
    },
    { transaction: t },
  )

  await schedule.update(
    { next_run_date: advanceNextRunDate(schedule.next_run_date, schedule.frequency) },
    { transaction: t },
  )

  return expense
}

// ─── Backward-compatible aliases ─────────────────────────────────────────────

/** @deprecated Use listExpenseSchedules */
export const listRecurringExpenseTemplates = listExpenseSchedules
/** @deprecated Use getExpenseSchedule */
export const getRecurringExpenseTemplate = getExpenseSchedule
/** @deprecated Use createExpenseSchedule */
export const createRecurringExpenseTemplate = createExpenseSchedule
/** @deprecated Use updateExpenseSchedule */
export const updateRecurringExpenseTemplate = updateExpenseSchedule
/** @deprecated Use deleteExpenseSchedule */
export const deleteRecurringExpenseTemplate = deleteExpenseSchedule
/** @deprecated Use findDueExpenseSchedules */
export const findDueRecurringExpenseTemplates = findDueExpenseSchedules
/** @deprecated Use generateExpenseFromSchedule */
export const generateExpenseFromTemplate = generateExpenseFromSchedule
