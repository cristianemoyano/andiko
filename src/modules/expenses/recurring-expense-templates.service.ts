import 'server-only'
import type { Transaction } from 'sequelize'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import RecurringExpenseTemplate from './recurring-expense-template.model'
import Expense from './expense.model'
import type {
  RecurringExpenseTemplateInput,
  RecurringExpenseTemplateUpdateInput,
  RecurringExpenseTemplateQuery,
} from './recurring-expense-template.schema'
import { nextExpenseDocNumber, calcExpenseTotals, advanceNextRunDate } from './expenses.utils'
import { ensureExpensesBranchAssociations } from './expenses-branch-associations'
import type { IvaRate } from '@/types'

export async function listRecurringExpenseTemplates(query: RecurringExpenseTemplateQuery, orgId: string) {
  ensureExpensesBranchAssociations()

  const { page, limit, contact_id, is_active } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = { org_id: orgId }
  if (contact_id) where.contact_id = contact_id
  if (is_active !== undefined) where.is_active = is_active

  const { default: Branch }  = await import('@/modules/auth/branch.model')
  const { default: Contact } = await import('@/modules/contacts/contact.model')

  const { rows, count } = await RecurringExpenseTemplate.findAndCountAll({
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

export async function getRecurringExpenseTemplate(id: string, orgId: string) {
  ensureExpensesBranchAssociations()

  const { default: Branch }  = await import('@/modules/auth/branch.model')
  const { default: Contact } = await import('@/modules/contacts/contact.model')

  const template = await RecurringExpenseTemplate.findOne({
    where: { id, org_id: orgId },
    include: [
      { model: Branch,  as: 'branch',  attributes: ['id', 'name', 'branch_code'] },
      { model: Contact, as: 'contact', attributes: ['id', 'legal_name', 'trade_name'], required: false },
    ],
  })
  if (!template) throw new Error('RECURRING_EXPENSE_TEMPLATE_NOT_FOUND')
  return template
}

export async function createRecurringExpenseTemplate(
  input: RecurringExpenseTemplateInput,
  orgId: string,
  actorId: string,
) {
  const template = await RecurringExpenseTemplate.create({
    ...input,
    default_amount: String(input.default_amount),
    org_id:     orgId,
    created_by: actorId,
    updated_by: actorId,
  })
  logger.info({ templateId: template.id, orgId }, 'recurring expense template created')
  return template
}

export async function updateRecurringExpenseTemplate(
  id: string,
  input: RecurringExpenseTemplateUpdateInput,
  orgId: string,
  actorId: string,
) {
  const template = await RecurringExpenseTemplate.findOne({ where: { id, org_id: orgId } })
  if (!template) throw new Error('RECURRING_EXPENSE_TEMPLATE_NOT_FOUND')

  const { default_amount, ...rest } = input
  await template.update({
    ...rest,
    ...(default_amount !== undefined ? { default_amount: String(default_amount) } : {}),
    updated_by: actorId,
  })
  return template
}

export async function deleteRecurringExpenseTemplate(id: string, orgId: string, actorId: string) {
  const template = await RecurringExpenseTemplate.findOne({ where: { id, org_id: orgId } })
  if (!template) throw new Error('RECURRING_EXPENSE_TEMPLATE_NOT_FOUND')

  await template.update({ deleted_by: actorId })
  await template.destroy()
}

/**
 * Finds every active template due to generate (`next_run_date <= now`) for the
 * given org (optionally scoped to one branch), used by the recurring-expense
 * automation action.
 */
export async function findDueRecurringExpenseTemplates(
  orgId: string,
  branchId: string | null,
  now: Date,
): Promise<RecurringExpenseTemplate[]> {
  const { Op } = await import('sequelize')
  const where: Record<string, unknown> = {
    org_id: orgId,
    is_active: true,
    next_run_date: { [Op.lte]: now },
  }
  if (branchId) where.branch_id = branchId

  return RecurringExpenseTemplate.findAll({ where, limit: 500 })
}

/**
 * Generates a draft `Expense` from a recurring template and advances its
 * `next_run_date`. Runs inside the caller's transaction.
 */
export async function generateExpenseFromTemplate(
  template: RecurringExpenseTemplate,
  orgId: string,
  t: Transaction,
): Promise<Expense> {
  const docNumber = await nextExpenseDocNumber(orgId, template.branch_id, 'expense', t)
  const totals = calcExpenseTotals(template.default_amount, '0.00', template.iva_rate as IvaRate)

  const now = new Date()
  const expense = await Expense.create(
    {
      org_id:                orgId,
      branch_id:             template.branch_id,
      contact_id:            template.contact_id,
      recurring_template_id: template.id,
      expense_number:        docNumber,
      description:           template.description,
      expense_account_code:  template.expense_account_code,
      status:                'draft',
      invoice_date:          now,
      due_date:              now,
      paid_amount:           '0.00',
      balance:               totals.total,
      ...totals,
    },
    { transaction: t },
  )

  await template.update(
    { next_run_date: advanceNextRunDate(template.next_run_date, template.frequency) },
    { transaction: t },
  )

  return expense
}
