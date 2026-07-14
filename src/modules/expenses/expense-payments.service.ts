import 'server-only'
import Decimal from 'decimal.js'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import { Op } from 'sequelize'
import ExpensePayment from './expense-payment.model'
import Expense from './expense.model'
import ExpenseInstallment from './expense-installment.model'
import type { ExpensePaymentInput, ExpensePaymentUpdateInput, ExpensePaymentQuery } from './expense-payment.schema'
import { nextExpenseDocNumber } from './expenses.utils'
import { recalcExpenseBalance } from './expenses.service'
import { ensureExpensesBranchAssociations } from './expenses-branch-associations'
import type { TenantContext } from '@/lib/tenancy'
import { postExpensePaymentAccounting } from '@/modules/accounting/expense-payment-accounting.service'

export async function listExpensePayments(query: ExpensePaymentQuery, orgId: string) {
  ensureExpensesBranchAssociations()

  const { page, limit, expense_id, contact_id } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = { org_id: orgId }
  if (expense_id) where.expense_id = expense_id
  if (contact_id) where.contact_id = contact_id

  const { default: Branch }  = await import('@/modules/auth/branch.model')
  const { default: Contact } = await import('@/modules/contacts/contact.model')

  const { rows, count } = await ExpensePayment.findAndCountAll({
    where,
    limit,
    offset,
    order: [['payment_date', 'DESC']],
    attributes: [
      'id', 'branch_id', 'expense_id', 'contact_id',
      'payment_number', 'payment_date', 'amount', 'payment_method',
      'notes', 'created_at',
    ],
    include: [
      { model: Branch,  as: 'branch',  attributes: ['id', 'name', 'branch_code'] },
      { model: Contact, as: 'contact', attributes: ['id', 'legal_name', 'trade_name'], required: false },
      { model: Expense, as: 'expense', attributes: ['id', 'expense_number', 'total', 'balance', 'kind'] },
    ],
  })

  return toPaginated(rows, count, page, limit)
}

export async function getExpensePayment(id: string, orgId: string) {
  ensureExpensesBranchAssociations()

  const { default: Branch }  = await import('@/modules/auth/branch.model')
  const { default: Contact } = await import('@/modules/contacts/contact.model')
  const { default: User }    = await import('@/modules/auth/user.model')

  const payment = await ExpensePayment.findOne({
    where: { id, org_id: orgId },
    include: [
      { model: Branch,  as: 'branch',  attributes: ['id', 'name', 'branch_code'] },
      { model: Contact, as: 'contact', attributes: ['id', 'legal_name', 'trade_name'], required: false },
      { model: User,    as: 'buyer',   attributes: ['id', 'name'] },
      { model: Expense, as: 'expense', attributes: ['id', 'expense_number', 'total', 'balance', 'kind'] },
    ],
  })
  if (!payment) throw new Error('EXPENSE_PAYMENT_NOT_FOUND')
  return payment
}

/** Registers a payment against an expense and atomically updates its balance/status. */
export async function registerExpensePayment(input: ExpensePaymentInput, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const expense = await Expense.findOne({
      where: { id: input.expense_id, org_id: orgId },
      attributes: ['id', 'status', 'branch_id', 'contact_id', 'kind'],
      transaction: t,
      lock: true,
    })
    if (!expense) throw new Error('EXPENSE_NOT_FOUND')
    if (expense.status === 'cancelled') throw new Error('EXPENSE_CANCELLED')
    if (expense.status === 'paid')      throw new Error('EXPENSE_ALREADY_PAID')
    if (expense.status === 'draft')     throw new Error('EXPENSE_NOT_RECEIVED')

    const installmentIds = input.installment_ids

    if (expense.kind === 'installment_plan') {
      if (!installmentIds?.length) throw new Error('INSTALLMENT_IDS_REQUIRED')

      const installments = await ExpenseInstallment.findAll({
        where: {
          id: { [Op.in]: installmentIds },
          expense_id: expense.id,
          org_id: orgId,
          deleted_at: null,
        },
        transaction: t,
        lock: true,
      })
      if (installments.length !== installmentIds.length) {
        throw new Error('INSTALLMENT_NOT_FOUND')
      }
      if (installments.some(i => i.status !== 'pending')) {
        throw new Error('INSTALLMENT_NOT_PENDING')
      }

      const expected = installments.reduce((acc, i) => acc.plus(i.amount), new Decimal(0))
      if (!expected.eq(input.amount)) {
        throw new Error('INSTALLMENT_AMOUNT_MISMATCH')
      }
    } else if (installmentIds?.length) {
      throw new Error('INSTALLMENTS_NOT_APPLICABLE')
    }

    const branchId = input.branch_id ?? expense.branch_id
    if (!branchId) throw new Error('EXPENSE_PAYMENT_BRANCH_REQUIRED')

    const docNumber = await nextExpenseDocNumber(orgId, branchId, 'expense_payment', t)

    const payment = await ExpensePayment.create(
      {
        branch_id:      branchId,
        expense_id:     input.expense_id,
        contact_id:     input.contact_id ?? expense.contact_id ?? null,
        org_id:         orgId,
        payment_number: docNumber,
        buyer_id:       actorId,
        payment_date:   input.payment_date,
        amount:         String(input.amount),
        payment_method: input.payment_method,
        notes:          input.notes ?? null,
        created_by:     actorId,
        updated_by:     actorId,
      },
      { transaction: t },
    )

    if (expense.kind === 'installment_plan' && installmentIds?.length) {
      const now = new Date()
      await ExpenseInstallment.update(
        {
          status: 'paid',
          expense_payment_id: payment.id,
          paid_at: now,
          updated_by: actorId,
        },
        {
          where: { id: { [Op.in]: installmentIds }, expense_id: expense.id },
          transaction: t,
        },
      )
    }

    await recalcExpenseBalance(input.expense_id, t)

    const ctx: TenantContext = { orgId, userId: actorId, defaultBranchId: null, allowedBranchIds: [] }
    await postExpensePaymentAccounting(payment.id, ctx, t)

    logger.info({ paymentId: payment.id, expenseId: input.expense_id, orgId }, 'expense payment created')
    return payment
  })
}

export async function updateExpensePayment(id: string, input: ExpensePaymentUpdateInput, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const payment = await ExpensePayment.findOne({
      where: { id, org_id: orgId },
      transaction: t,
      lock: true,
    })
    if (!payment) throw new Error('EXPENSE_PAYMENT_NOT_FOUND')

    await payment.update({ ...input, amount: input.amount !== undefined ? String(input.amount) : undefined, updated_by: actorId }, { transaction: t })
    await recalcExpenseBalance(payment.expense_id, t)

    return payment
  })
}

export async function deleteExpensePayment(id: string, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const payment = await ExpensePayment.findOne({
      where: { id, org_id: orgId },
      transaction: t,
      lock: true,
    })
    if (!payment) throw new Error('EXPENSE_PAYMENT_NOT_FOUND')

    const expenseId = payment.expense_id

    await ExpenseInstallment.update(
      {
        status: 'pending',
        expense_payment_id: null,
        paid_at: null,
        updated_by: actorId,
      },
      {
        where: { expense_payment_id: id, deleted_at: null },
        transaction: t,
      },
    )

    await payment.update({ deleted_by: actorId }, { transaction: t })
    await payment.destroy({ transaction: t })

    await recalcExpenseBalance(expenseId, t)
    logger.info({ paymentId: id, orgId }, 'expense payment deleted')
  })
}
