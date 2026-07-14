import 'server-only'
import { Op } from 'sequelize'
import Decimal from 'decimal.js'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import Expense from './expense.model'
import ExpensePayment from './expense-payment.model'
import ExpenseInstallment from './expense-installment.model'
import ExpenseSchedule from './expense-schedule.model'
import type { ExpenseCreateInput, ExpenseUpdateInput, ExpenseQuery } from './expense.schema'
import {
  nextExpenseDocNumber,
  calcExpenseTotals,
  calcExpenseTotalsFromGross,
  buildInstallmentSchedule,
  advanceNextRunDate,
} from './expenses.utils'
import { createExpenseSchedule } from './expense-schedules.service'
import { ensureExpensesBranchAssociations } from './expenses-branch-associations'
import type { IvaRate } from '@/types'
import type { TenantContext } from '@/lib/tenancy'
import { postExpenseAccounting } from '@/modules/accounting/expense-accounting.service'

export async function listExpenses(query: ExpenseQuery, orgId: string) {
  ensureExpensesBranchAssociations()

  const { page, limit, search, status, kind, contact_id, overdue } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = { org_id: orgId }
  if (status)     where.status     = status
  if (kind)       where.kind       = kind
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
      'id', 'branch_id', 'expense_number', 'invoice_number', 'status', 'kind',
      'contact_id', 'schedule_id', 'description', 'expense_account_code',
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
      { model: Branch,            as: 'branch',       attributes: ['id', 'name', 'branch_code'] },
      { model: Contact,           as: 'contact',      attributes: ['id', 'legal_name', 'trade_name'], required: false },
      { model: User,              as: 'buyer',        attributes: ['id', 'name'] },
      { model: ExpensePayment,    as: 'payments',     where: { deleted_at: null }, required: false },
      {
        model: ExpenseInstallment,
        as: 'installments',
        where: { deleted_at: null },
        required: false,
        separate: true,
        order: [['installment_number', 'ASC']],
      },
      {
        model: ExpenseSchedule,
        as: 'schedule',
        attributes: [
          'id', 'frequency', 'next_run_date', 'is_active', 'default_amount',
          'description', 'expense_account_code', 'iva_rate', 'branch_id', 'contact_id',
        ],
        required: false,
      },
    ],
  })
  if (!expense) throw new Error('EXPENSE_NOT_FOUND')
  return expense
}

export async function createExpense(input: ExpenseCreateInput, orgId: string, actorId: string) {
  if (input.kind === 'recurring') {
    return createRecurringExpenseWithFirstOccurrence(input, orgId, actorId)
  }
  if (input.kind === 'installment_plan') {
    return createInstallmentPlanExpense(input, orgId, actorId)
  }
  return createOneOffExpense(input, orgId, actorId)
}

async function createOneOffExpense(
  input: Extract<ExpenseCreateInput, { kind: 'one_off' }>,
  orgId: string,
  actorId: string,
) {
  return sequelize.transaction(async (t) => {
    const { branch_id, iva_rate, kind, ...fields } = input
    void kind

    const docNumber = await nextExpenseDocNumber(orgId, branch_id, 'expense', t)
    const totals = calcExpenseTotals(fields.subtotal, fields.discount_amount, iva_rate as IvaRate)

    const expense = await Expense.create(
      {
        ...fields,
        branch_id,
        kind:           'one_off',
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

    logger.info({ expenseId: expense.id, orgId, number: docNumber, kind: 'one_off' }, 'expense created')
    return expense
  })
}

async function createRecurringExpenseWithFirstOccurrence(
  input: Extract<ExpenseCreateInput, { kind: 'recurring' }>,
  orgId: string,
  actorId: string,
) {
  return sequelize.transaction(async (t) => {
    const schedule = await createExpenseSchedule(
      {
        branch_id:            input.branch_id,
        contact_id:           input.contact_id,
        description:          input.description,
        expense_account_code: input.expense_account_code,
        default_amount:       input.default_amount,
        iva_rate:             input.iva_rate,
        frequency:            input.frequency,
        next_run_date:        input.next_run_date,
        is_active:            input.is_active,
      },
      orgId,
      actorId,
      t,
    )

    const docNumber = await nextExpenseDocNumber(orgId, input.branch_id, 'expense', t)
    const totals = calcExpenseTotals(input.default_amount, '0.00', input.iva_rate as IvaRate)
    const periodDate = input.next_run_date

    // First period is created now; advance schedule so automation won't duplicate it.
    await schedule.update(
      { next_run_date: advanceNextRunDate(input.next_run_date, input.frequency) },
      { transaction: t },
    )

    const expense = await Expense.create(
      {
        org_id:               orgId,
        branch_id:            input.branch_id,
        contact_id:           input.contact_id,
        schedule_id:          schedule.id,
        kind:                 'recurring_occurrence',
        expense_number:       docNumber,
        description:          input.description,
        expense_account_code: input.expense_account_code,
        iva_rate:             input.iva_rate as IvaRate,
        currency:             input.currency,
        notes:                input.notes ?? null,
        status:               'draft',
        invoice_date:         periodDate,
        due_date:             periodDate,
        buyer_id:             actorId,
        paid_amount:          '0.00',
        balance:              totals.total,
        created_by:           actorId,
        updated_by:           actorId,
        ...totals,
      },
      { transaction: t },
    )

    logger.info(
      { expenseId: expense.id, scheduleId: schedule.id, orgId, kind: 'recurring' },
      'recurring expense created with first occurrence',
    )
    return expense
  })
}

async function createInstallmentPlanExpense(
  input: Extract<ExpenseCreateInput, { kind: 'installment_plan' }>,
  orgId: string,
  actorId: string,
) {
  return sequelize.transaction(async (t) => {
    const gross = input.total != null
      ? new Decimal(input.total)
      : new Decimal(input.installment_amount!).mul(input.installment_count)

    const totals = calcExpenseTotalsFromGross(
      gross.toFixed(2),
      input.discount_amount,
      input.iva_rate as IvaRate,
    )

    const drafts = buildInstallmentSchedule({
      count:        input.installment_count,
      firstDueDate: input.first_due_date,
      frequency:    input.installment_frequency,
      total:        totals.total,
    })

    const docNumber = await nextExpenseDocNumber(orgId, input.branch_id, 'expense', t)
    const invoiceDate = input.invoice_date ?? new Date()

    const expense = await Expense.create(
      {
        org_id:               orgId,
        branch_id:            input.branch_id,
        contact_id:           input.contact_id,
        kind:                 'installment_plan',
        expense_number:       docNumber,
        description:          input.description,
        expense_account_code: input.expense_account_code,
        invoice_number:       input.invoice_number ?? null,
        iva_rate:             input.iva_rate as IvaRate,
        currency:             input.currency,
        notes:                input.notes ?? null,
        status:               'draft',
        invoice_date:         invoiceDate,
        due_date:             drafts[0]!.due_date,
        buyer_id:             actorId,
        paid_amount:          '0.00',
        balance:              totals.total,
        created_by:           actorId,
        updated_by:           actorId,
        ...totals,
      },
      { transaction: t },
    )

    await ExpenseInstallment.bulkCreate(
      drafts.map(d => ({
        org_id:             orgId,
        expense_id:         expense.id,
        installment_number: d.installment_number,
        due_date:           d.due_date,
        amount:             d.amount,
        status:             'pending' as const,
        created_by:         actorId,
        updated_by:         actorId,
      })),
      { transaction: t },
    )

    logger.info(
      { expenseId: expense.id, orgId, installments: drafts.length, kind: 'installment_plan' },
      'installment plan expense created',
    )
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
    if (expense.kind === 'installment_plan' && (input.subtotal !== undefined || input.discount_amount !== undefined)) {
      throw new Error('INSTALLMENT_PLAN_AMOUNTS_LOCKED')
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

    if (expense.kind === 'installment_plan') {
      const installments = await ExpenseInstallment.findAll({
        where: { expense_id: id },
        transaction: t,
      })
      for (const row of installments) {
        await row.update({ deleted_by: actorId }, { transaction: t })
        await row.destroy({ transaction: t })
      }
    }

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

    if (expense.kind === 'installment_plan') {
      await ExpenseInstallment.update(
        { status: 'cancelled', updated_by: actorId },
        { where: { expense_id: id, status: 'pending', deleted_at: null }, transaction: t },
      )
    }

    await expense.update({ status: 'cancelled', updated_by: actorId }, { transaction: t })
    logger.info({ expenseId: id }, 'expense cancelled')
    return expense
  })
}

/**
 * Recalculates `paid_amount`, `balance`, and `status` for an expense based on
 * current non-deleted payments. Called atomically within a transaction.
 * For installment plans, also refreshes `due_date` to the next unpaid cuota.
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

  const patch: Record<string, unknown> = {
    paid_amount: paid.toFixed(2),
    balance: balance.toFixed(2),
    status,
  }

  if (expense.kind === 'installment_plan') {
    const nextPending = await ExpenseInstallment.findOne({
      where: { expense_id: expenseId, status: 'pending', deleted_at: null },
      order: [['installment_number', 'ASC']],
      attributes: ['due_date'],
      transaction: t,
    })
    if (nextPending) patch.due_date = nextPending.due_date
  }

  await expense.update(patch, { transaction: t })
}
