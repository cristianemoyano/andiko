import 'server-only'
import { Op } from 'sequelize'
import Decimal from 'decimal.js'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import Expense from './expense.model'
import ExpensePayment from './expense-payment.model'
import type { ExpenseInput, ExpenseUpdateInput, ExpenseQuery } from './expense.schema'
import { nextExpenseDocNumber, calcExpenseTotals } from './expenses.utils'
import { ensureExpensesBranchAssociations } from './expenses-branch-associations'
import type { IvaRate } from '@/types'
import type { TenantContext } from '@/lib/tenancy'
import { postExpenseAccounting } from '@/modules/accounting/expense-accounting.service'

export async function listExpenses(query: ExpenseQuery, orgId: string) {
  ensureExpensesBranchAssociations()

  const { page, limit, search, status, contact_id, overdue } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = { org_id: orgId }
  if (status)     where.status     = status
  if (contact_id) where.contact_id = contact_id
  if (search) {
    where[Op.or as unknown as string] = [
      { expense_number: { [Op.iLike]: `%${search}%` } },
      { invoice_number:  { [Op.iLike]: `%${search}%` } },
      { description:     { [Op.iLike]: `%${search}%` } },
    ]
  }
  if (overdue) {
    where.due_date = { [Op.lt]: new Date() }
    where.status   = { [Op.notIn]: ['paid', 'cancelled'] }
  }

  const { default: Branch }  = await import('@/modules/auth/branch.model')
  const { default: Contact } = await import('@/modules/contacts/contact.model')

  const { rows, count } = await Expense.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'DESC']],
    attributes: [
      'id', 'branch_id', 'expense_number', 'invoice_number', 'status',
      'contact_id', 'recurring_template_id', 'description', 'expense_account_code',
      'invoice_date', 'due_date', 'currency', 'iva_rate',
      'subtotal', 'tax_amount', 'total', 'paid_amount', 'balance',
      'notes', 'created_at',
    ],
    include: [
      { model: Branch,  as: 'branch',  attributes: ['id', 'name', 'branch_code'] },
      { model: Contact, as: 'contact', attributes: ['id', 'legal_name', 'trade_name'], required: false },
    ],
  })

  return toPaginated(rows, count, page, limit)
}

export async function getExpense(id: string, orgId: string) {
  ensureExpensesBranchAssociations()

  const { default: Branch }  = await import('@/modules/auth/branch.model')
  const { default: Contact } = await import('@/modules/contacts/contact.model')
  const { default: User }    = await import('@/modules/auth/user.model')

  const expense = await Expense.findOne({
    where: { id, org_id: orgId },
    include: [
      { model: Branch,         as: 'branch',   attributes: ['id', 'name', 'branch_code'] },
      { model: Contact,        as: 'contact',  attributes: ['id', 'legal_name', 'trade_name'], required: false },
      { model: User,           as: 'buyer',    attributes: ['id', 'name'] },
      { model: ExpensePayment, as: 'payments', where: { deleted_at: null }, required: false },
    ],
  })
  if (!expense) throw new Error('EXPENSE_NOT_FOUND')
  return expense
}

export async function createExpense(input: ExpenseInput, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const { branch_id, iva_rate, ...fields } = input

    const docNumber = await nextExpenseDocNumber(orgId, branch_id, 'expense', t)
    const totals = calcExpenseTotals(fields.subtotal, fields.discount_amount, iva_rate as IvaRate)

    const expense = await Expense.create(
      {
        ...fields,
        branch_id,
        iva_rate:       iva_rate as IvaRate,
        org_id:         orgId,
        expense_number: docNumber,
        buyer_id:       actorId,
        status:         'draft',
        paid_amount:    '0.00',
        balance:        totals.total,
        created_by:     actorId,
        updated_by:     actorId,
        ...totals,
      },
      { transaction: t },
    )

    logger.info({ expenseId: expense.id, orgId, number: docNumber }, 'expense created')
    return expense
  })
}

export async function updateExpense(id: string, input: ExpenseUpdateInput, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const expense = await Expense.findOne({
      where: { id, org_id: orgId },
      transaction: t,
      lock: true,
    })
    if (!expense) throw new Error('EXPENSE_NOT_FOUND')
    if (expense.status === 'paid' || expense.status === 'cancelled') {
      throw new Error('EXPENSE_LOCKED')
    }

    const { iva_rate, subtotal, discount_amount, ...restFields } = input

    if (subtotal !== undefined || discount_amount !== undefined || iva_rate !== undefined) {
      const effectiveIvaRate = (iva_rate ?? expense.iva_rate) as IvaRate
      const totals = calcExpenseTotals(
        subtotal ?? expense.subtotal,
        discount_amount ?? expense.discount_amount,
        effectiveIvaRate,
      )
      await expense.update(
        { ...restFields, iva_rate: effectiveIvaRate, ...totals, balance: new Decimal(totals.total).minus(expense.paid_amount).toFixed(2), updated_by: actorId },
        { transaction: t },
      )
    } else {
      await expense.update({ ...restFields, updated_by: actorId }, { transaction: t })
    }

    return expense
  })
}

export async function deleteExpense(id: string, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const expense = await Expense.findOne({
      where: { id, org_id: orgId },
      transaction: t,
    })
    if (!expense) throw new Error('EXPENSE_NOT_FOUND')
    if (expense.status !== 'draft') throw new Error('EXPENSE_NOT_DRAFT')

    await expense.update({ deleted_by: actorId }, { transaction: t })
    await expense.destroy({ transaction: t })
  })
}

/** Marks an expense as received (formally registered) and posts its accounting entry. */
export async function receiveExpense(id: string, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const expense = await Expense.findOne({
      where: { id, org_id: orgId },
      transaction: t,
      lock: true,
    })
    if (!expense) throw new Error('EXPENSE_NOT_FOUND')
    if (expense.status !== 'draft') throw new Error('EXPENSE_NOT_DRAFT')

    await expense.update({ status: 'received', updated_by: actorId }, { transaction: t })

    const ctx: TenantContext = { orgId, userId: actorId, defaultBranchId: null, allowedBranchIds: [] }
    await postExpenseAccounting(id, ctx, t)

    logger.info({ expenseId: id }, 'expense received')
    return expense
  })
}

export async function cancelExpense(id: string, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const expense = await Expense.findOne({
      where: { id, org_id: orgId },
      transaction: t,
      lock: true,
    })
    if (!expense) throw new Error('EXPENSE_NOT_FOUND')
    if (expense.status === 'paid')      throw new Error('EXPENSE_ALREADY_PAID')
    if (expense.status === 'cancelled') throw new Error('EXPENSE_ALREADY_CANCELLED')

    await expense.update({ status: 'cancelled', updated_by: actorId }, { transaction: t })
    logger.info({ expenseId: id }, 'expense cancelled')
    return expense
  })
}

/**
 * Recalculates `paid_amount`, `balance`, and `status` for an expense based on
 * current non-deleted payments. Called atomically within a transaction.
 */
export async function recalcExpenseBalance(expenseId: string, t: import('sequelize').Transaction) {
  const expense = await Expense.findByPk(expenseId, { transaction: t, lock: true })
  if (!expense || expense.status === 'cancelled') return

  const payments = await ExpensePayment.findAll({
    where: { expense_id: expenseId, deleted_at: null },
    attributes: ['amount'],
    transaction: t,
  })

  const paid    = payments.reduce((acc, p) => acc.plus(p.amount), new Decimal(0))
  const total   = new Decimal(expense.total)
  const balance = Decimal.max(total.minus(paid), new Decimal(0))

  const status =
    paid.gte(total) ? 'paid' :
    paid.gt(0)      ? 'partially_paid' :
    expense.status === 'received' || expense.status === 'partially_paid' ? expense.status :
    'received'

  await expense.update(
    { paid_amount: paid.toFixed(2), balance: balance.toFixed(2), status },
    { transaction: t },
  )
}
