import 'server-only'
import type { Transaction } from 'sequelize'
import Decimal from 'decimal.js'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import ExpenseSchedule from './expense-schedule.model'
import Expense from './expense.model'
import ExpenseScheduleItem from './expense-schedule-item.model'
import type {
  ExpenseScheduleInput,
  ExpenseScheduleUpdateInput,
  ExpenseScheduleQuery,
} from './expense-schedule.schema'
import { nextExpenseDocNumber, calcExpenseTotals, advanceNextRunDate } from './expenses.utils'
import { ensureExpensesBranchAssociations } from './expenses-branch-associations'
import type { IvaRate } from '@/types'
import {
  calculateExpenseItems,
  createExpenseItems,
  createExpenseScheduleItems,
  scheduleItemsToInput,
} from './expense-items.service'

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
      { model: ExpenseScheduleItem, as: 'items', required: false, separate: true, order: [['sort_order', 'ASC']] },
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
      { model: ExpenseScheduleItem, as: 'items', required: false, separate: true, order: [['sort_order', 'ASC']] },
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
  const { items, ...scheduleInput } = input
  const calculatedItems = items?.length ? calculateExpenseItems(items) : null
  const effectiveDefaultAmount = calculatedItems
    ? calculatedItems.lines.reduce((sum, line) => sum.plus(line.totals.tax_base), new Decimal(0)).toFixed(2)
    : String(input.default_amount)
  const schedule = await ExpenseSchedule.create(
    {
      ...scheduleInput,
      kind:           'recurring',
      expense_account_code: items?.[0]?.expense_account_code ?? input.expense_account_code,
      iva_rate:       (items?.[0]?.iva_rate ?? input.iva_rate) as IvaRate,
      default_amount: effectiveDefaultAmount,
      org_id:         orgId,
      created_by:     actorId,
      updated_by:     actorId,
    },
    { transaction: t },
  )
  if (items?.length) {
    if (!t) throw new Error('EXPENSE_SCHEDULE_ITEMS_REQUIRE_TRANSACTION')
    await createExpenseScheduleItems(schedule.id, items, orgId, actorId, t)
  }
  logger.info({ scheduleId: schedule.id, orgId }, 'expense schedule created')
  return schedule
}

export async function updateExpenseSchedule(
  id: string,
  input: ExpenseScheduleUpdateInput,
  orgId: string,
  actorId: string,
) {
  return sequelize.transaction(async (t) => {
    const schedule = await ExpenseSchedule.findOne({
      where: { id, org_id: orgId },
      transaction: t,
      lock: true,
    })
    if (!schedule) throw new Error('EXPENSE_SCHEDULE_NOT_FOUND')

    const { default_amount, items, ...rest } = input
    let effectiveDefaultAmount = default_amount
    const itemHeaderPatch: Record<string, unknown> = {}
    if (items?.length) {
      const calculated = calculateExpenseItems(items)
      effectiveDefaultAmount = Number(
        calculated.lines.reduce(
          (sum, line) => sum.plus(line.totals.tax_base),
          new Decimal(0),
        ).toFixed(2),
      )
      await ExpenseScheduleItem.destroy({ where: { schedule_id: id }, transaction: t })
      await createExpenseScheduleItems(id, items, orgId, actorId, t)
      itemHeaderPatch.expense_account_code = items[0]!.expense_account_code
      itemHeaderPatch.iva_rate = items[0]!.iva_rate
    }
    await schedule.update({
      ...rest,
      ...itemHeaderPatch,
      ...(effectiveDefaultAmount !== undefined ? { default_amount: String(effectiveDefaultAmount) } : {}),
      updated_by: actorId,
    }, { transaction: t })
    return schedule
  })
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
  const scheduleItems = await ExpenseScheduleItem.findAll({
    where: { schedule_id: schedule.id, org_id: orgId },
    order: [['sort_order', 'ASC']],
    transaction: t,
  })
  const itemInputs = scheduleItemsToInput(scheduleItems)
  const totals = itemInputs.length
    ? calculateExpenseItems(itemInputs).totals
    : calcExpenseTotals(schedule.default_amount, '0.00', schedule.iva_rate as IvaRate)

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
  if (itemInputs.length) {
    await createExpenseItems(
      expense.id,
      itemInputs,
      orgId,
      schedule.updated_by ?? schedule.created_by,
      t,
    )
  }

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
