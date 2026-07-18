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
import ExpenseItem from './expense-item.model'
import ExpenseScheduleItem from './expense-schedule-item.model'
import CreditCardStatement from './credit-card-statement.model'
import CreditCard from './credit-card.model'
import type { ExpenseCreateInput, ExpenseUpdateInput, ExpenseQuery } from './expense.schema'
import {
  nextExpenseDocNumber,
  calcExpenseTotals,
  calcExpenseTotalsFromGross,
  buildInstallmentSchedule,
  advanceNextRunDate,
} from './expenses.utils'
import { calculateExpenseItems, createExpenseItems } from './expense-items.service'
import { createExpenseSchedule } from './expense-schedules.service'
import { ensureExpensesBranchAssociations } from './expenses-branch-associations'
import type { IvaRate } from '@/types'
import type { TenantContext } from '@/lib/tenancy'
import { postExpenseAccounting, reverseExpenseAccounting } from '@/modules/accounting/expense-accounting.service'

export async function listExpenses(query: ExpenseQuery, orgId: string) {
  ensureExpensesBranchAssociations()

  const { page, limit, search, status, statuses, kind, contact_id, overdue } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = { org_id: orgId }
  if (status)                        where.status     = status
  else if (statuses && statuses.length) where.status  = { [Op.in]: statuses }
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
        model: ExpenseItem,
        as: 'items',
        where: { deleted_at: null },
        required: false,
        separate: true,
        order: [['sort_order', 'ASC']],
      },
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
        include: [
          {
            model: ExpenseScheduleItem,
            as: 'items',
            where: { deleted_at: null },
            required: false,
            separate: true,
            order: [['sort_order', 'ASC']],
          },
        ],
      },
      {
        model: CreditCardStatement,
        as: 'credit_card_statement',
        attributes: [
          'id', 'credit_card_id', 'period_label', 'closing_date', 'due_date',
          'amount_ars', 'amount_usd', 'fx_rate', 'amount_ars_total',
        ],
        required: false,
        include: [
          { model: CreditCard, as: 'credit_card', attributes: ['id', 'name', 'last_four'] },
        ],
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
    const { branch_id, iva_rate, kind, items, ...fields } = input
    void kind

    const docNumber = await nextExpenseDocNumber(orgId, branch_id, 'expense', t)
    const totals = items?.length
      ? calculateExpenseItems(items).totals
      : calcExpenseTotals(fields.subtotal, fields.discount_amount, iva_rate as IvaRate)
    const primaryAccountCode = items?.[0]?.expense_account_code ?? fields.expense_account_code
    const primaryIvaRate = items?.[0]?.iva_rate ?? iva_rate

    const expense = await Expense.create(
      {
        ...fields,
        branch_id,
        kind:           'one_off',
        expense_account_code: primaryAccountCode,
        iva_rate:       primaryIvaRate as IvaRate,
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
    if (items?.length) {
      await createExpenseItems(expense.id, items, orgId, actorId, t)
    }

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
        items:                input.items,
      },
      orgId,
      actorId,
      t,
    )

    const docNumber = await nextExpenseDocNumber(orgId, input.branch_id, 'expense', t)
    const totals = input.items?.length
      ? calculateExpenseItems(input.items).totals
      : calcExpenseTotals(input.default_amount, '0.00', input.iva_rate as IvaRate)
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
        expense_account_code: input.items?.[0]?.expense_account_code ?? input.expense_account_code,
        iva_rate:             (input.items?.[0]?.iva_rate ?? input.iva_rate) as IvaRate,
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
    if (input.items?.length) {
      await createExpenseItems(expense.id, input.items, orgId, actorId, t)
    }

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
    const manualRows = input.installments?.length
      ? [...input.installments]
          .map((row, index) => ({
            installment_number: row.installment_number ?? index + 1,
            due_date: row.due_date,
            amount: new Decimal(row.amount).toFixed(2),
            status: row.status,
            paid_at: row.status === 'paid' ? (row.paid_at ?? row.due_date) : null,
          }))
          .sort((a, b) => a.installment_number - b.installment_number)
      : null

    const gross = manualRows
      ? manualRows.reduce((sum, row) => sum.plus(row.amount), new Decimal(0))
      : input.total != null
        ? new Decimal(input.total)
        : new Decimal(input.installment_amount!).mul(input.installment_count!)

    const totals = calcExpenseTotalsFromGross(
      gross.toFixed(2),
      input.discount_amount,
      input.iva_rate as IvaRate,
    )

    const drafts = manualRows ?? buildInstallmentSchedule({
      count:        input.installment_count!,
      firstDueDate: input.first_due_date!,
      frequency:    input.installment_frequency ?? 'monthly',
      total:        totals.total,
    }).map(d => ({ ...d, status: 'pending' as const, paid_at: null }))

    const prepaid = drafts
      .filter(d => d.status === 'paid')
      .reduce((sum, d) => sum.plus(d.amount), new Decimal(0))
    const balance = new Decimal(totals.total).minus(prepaid)
    const nextDue = drafts.find(d => d.status === 'pending')?.due_date ?? drafts[0]!.due_date

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
        due_date:             nextDue,
        buyer_id:             actorId,
        paid_amount:          prepaid.toFixed(2),
        balance:              Decimal.max(balance, new Decimal(0)).toFixed(2),
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
        status:             d.status,
        paid_at:            d.paid_at,
        created_by:         actorId,
        updated_by:         actorId,
      })),
      { transaction: t },
    )

    logger.info(
      { expenseId: expense.id, orgId, installments: drafts.length, prepaid: prepaid.toFixed(2), kind: 'installment_plan' },
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
    // Once confirmed the amounts back a posted journal entry: to change them the
    // expense must first go back to draft (revertExpenseToDraft).
    if (
      expense.status !== 'draft'
      && (input.subtotal !== undefined || input.discount_amount !== undefined || input.iva_rate !== undefined)
    ) {
      throw new Error('EXPENSE_VALUES_LOCKED')
    }

    const { iva_rate, subtotal, discount_amount, items, ...restFields } = input

    if (items?.length) {
      if (expense.status !== 'draft') throw new Error('EXPENSE_ITEMS_LOCKED')
      const totals = calculateExpenseItems(items).totals
      await ExpenseItem.destroy({ where: { expense_id: id }, transaction: t })
      await createExpenseItems(id, items, orgId, actorId, t)
      await expense.update(
        {
          ...restFields,
          expense_account_code: items[0]!.expense_account_code,
          iva_rate: items[0]!.iva_rate as IvaRate,
          ...totals,
          balance: new Decimal(totals.total).minus(expense.paid_amount).toFixed(2),
          updated_by: actorId,
        },
        { transaction: t },
      )
      return expense
    }

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

export type ExpenseInstallmentPatch = {
  due_date?: Date
  amount?: number
}

/**
 * Updates a pending cuota (data-entry fix). Paid/cancelled cuotas are immutable.
 * - `due_date` can change while the expense isn't cancelled; refreshes the
 *   header `due_date` to the next pending cuota.
 * - `amount` can change on any non-cancelled plan (draft, received or partially
 *   paid) as long as the cuota is still pending. The plan totals are recomputed
 *   from the cuotas, and for confirmed plans the journal entry is reversed and
 *   reposted so the liability matches the new total.
 */
export async function updateExpenseInstallment(
  expenseId: string,
  installmentId: string,
  patch: ExpenseInstallmentPatch,
  orgId: string,
  actorId: string,
) {
  return sequelize.transaction(async (t) => {
    const expense = await Expense.findOne({
      where: { id: expenseId, org_id: orgId },
      transaction: t,
      lock: true,
    })
    if (!expense) throw new Error('EXPENSE_NOT_FOUND')
    if (expense.kind !== 'installment_plan') throw new Error('EXPENSE_NOT_INSTALLMENT_PLAN')
    if (expense.status === 'cancelled') throw new Error('EXPENSE_LOCKED')

    const installment = await ExpenseInstallment.findOne({
      where: { id: installmentId, expense_id: expenseId, deleted_at: null },
      transaction: t,
    })
    if (!installment) throw new Error('INSTALLMENT_NOT_FOUND')
    if (installment.status !== 'pending') throw new Error('INSTALLMENT_NOT_PENDING')

    const installmentPatch: Record<string, unknown> = { updated_by: actorId }
    if (patch.due_date !== undefined) installmentPatch.due_date = patch.due_date
    if (patch.amount !== undefined) installmentPatch.amount = new Decimal(patch.amount).toFixed(2)
    await installment.update(installmentPatch, { transaction: t })

    if (patch.amount !== undefined) {
      // El total del plan surge de las cuotas: recalcular subtotal/IVA/total.
      const rows = await ExpenseInstallment.findAll({
        where: {
          expense_id: expenseId,
          status: { [Op.ne]: 'cancelled' },
          deleted_at: null,
        },
        attributes: ['amount', 'status'],
        transaction: t,
      })
      const gross = rows.reduce((acc, row) => acc.plus(row.amount), new Decimal(0))
      const totals = calcExpenseTotalsFromGross(gross.toFixed(2), expense.discount_amount, expense.iva_rate)

      if (expense.status === 'draft') {
        // Sin asiento aún: el pagado surge de cuotas prepagas al crear el plan.
        const paid = rows
          .filter(row => row.status === 'paid')
          .reduce((acc, row) => acc.plus(row.amount), new Decimal(0))
        await expense.update(
          {
            ...totals,
            paid_amount: paid.toFixed(2),
            balance: Decimal.max(gross.minus(paid), new Decimal(0)).toFixed(2),
            updated_by: actorId,
          },
          { transaction: t },
        )
      } else {
        // Plan confirmado: actualizar totales, recalcular saldo y rehacer el asiento.
        await expense.update({ ...totals, updated_by: actorId }, { transaction: t })
        await recalcExpenseBalance(expenseId, t)
        const ctx: TenantContext = { orgId, userId: actorId, defaultBranchId: null, allowedBranchIds: [] }
        await reverseExpenseAccounting(expenseId, expense.branch_id, ctx, t)
        await postExpenseAccounting(expenseId, ctx, t)
      }
    }

    const nextPending = await ExpenseInstallment.findOne({
      where: { expense_id: expenseId, status: 'pending', deleted_at: null },
      order: [['installment_number', 'ASC']],
      attributes: ['due_date'],
      transaction: t,
    })
    if (nextPending) {
      await expense.update({ due_date: nextPending.due_date, updated_by: actorId }, { transaction: t })
    }

    logger.info({ expenseId, installmentId, patch: Object.keys(patch) }, 'installment updated')
    return installment
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

    // Prepaid cuotas (historical, already settled outside Andiko) keep status=paid
    // without a payment row; refresh balance/status from installments + payments.
    if (expense.kind === 'installment_plan') {
      await recalcExpenseBalance(id, t)
    }

    logger.info({ expenseId: id }, 'expense received')
    return expense
  })
}

/**
 * Sends a confirmed expense back to draft so its values can be corrected.
 * Only allowed while nothing depends on the posted amounts: no payments
 * registered and not generated from a credit card statement. The original
 * journal entry stays immutable; a reversal entry nets it to zero and a fresh
 * entry is posted when the expense is confirmed again.
 */
export async function revertExpenseToDraft(id: string, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const expense = await Expense.findOne({
      where: { id, org_id: orgId },
      transaction: t,
      lock: true,
    })
    if (!expense) throw new Error('EXPENSE_NOT_FOUND')
    if (expense.status !== 'received') throw new Error('EXPENSE_NOT_RECEIVED')

    const paymentsCount = await ExpensePayment.count({
      where: { expense_id: id, deleted_at: null },
      transaction: t,
    })
    if (paymentsCount > 0) throw new Error('EXPENSE_HAS_PAYMENTS')

    const statement = await CreditCardStatement.findOne({
      where: { expense_id: id },
      transaction: t,
    })
    if (statement) throw new Error('EXPENSE_FROM_CREDIT_CARD_STATEMENT')

    const ctx: TenantContext = { orgId, userId: actorId, defaultBranchId: null, allowedBranchIds: [] }
    await reverseExpenseAccounting(id, expense.branch_id, ctx, t)

    await expense.update({ status: 'draft', updated_by: actorId }, { transaction: t })

    logger.info({ expenseId: id }, 'expense reverted to draft')
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
    await syncLinkedCreditCardStatement(expense, t)
    logger.info({ expenseId: id }, 'expense cancelled')
    return expense
  })
}

/**
 * Mirrors status/paid_amount/balance onto the credit card statement linked to
 * this expense (if any), so the tarjetas view stays consistent with the payable.
 */
async function syncLinkedCreditCardStatement(
  expense: Expense,
  t: import('sequelize').Transaction,
) {
  const statement = await CreditCardStatement.findOne({
    where: { expense_id: expense.id },
    transaction: t,
  })
  if (!statement) return
  await statement.update(
    {
      status: expense.status,
      paid_amount: expense.paid_amount,
      balance: expense.balance,
      updated_by: expense.updated_by,
    },
    { transaction: t },
  )
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

  let paid = payments.reduce((acc, p) => acc.plus(p.amount), new Decimal(0))

  // Historical cuotas marked paid at create time (no ExpensePayment yet).
  if (expense.kind === 'installment_plan') {
    const orphanPaid = await ExpenseInstallment.findAll({
      where: {
        expense_id: expenseId,
        status: 'paid',
        expense_payment_id: null,
        deleted_at: null,
      },
      attributes: ['amount'],
      transaction: t,
    })
    paid = orphanPaid.reduce((acc, row) => acc.plus(row.amount), paid)
  }

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
  await syncLinkedCreditCardStatement(expense, t)
}
