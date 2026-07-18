import 'server-only'
import Decimal from 'decimal.js'
import { Op, type WhereOptions } from 'sequelize'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import type { TenantContext } from '@/lib/tenancy'
import type { IvaRate } from '@/types'
import { postExpenseAccounting, reverseExpenseAccounting } from '@/modules/accounting/expense-accounting.service'
import CreditCard from './credit-card.model'
import CreditCardStatement from './credit-card-statement.model'
import Expense from './expense.model'
import ExpensePayment from './expense-payment.model'
import type {
  CreditCardInput,
  CreditCardUpdateInput,
  CreditCardQuery,
  CreditCardStatementInput,
  CreditCardStatementAmountsInput,
  CreditCardStatementQuery,
} from './credit-card.schema'
import { nextExpenseDocNumber, calcExpenseTotals } from './expenses.utils'
import { ensureExpensesBranchAssociations } from './expenses-branch-associations'

export function computeStatementTotals(
  input: Pick<CreditCardStatementInput, 'amount_ars' | 'amount_usd' | 'fx_rate'>,
) {
  const ars = new Decimal(input.amount_ars || 0)
  const usd = new Decimal(input.amount_usd || 0)
  const fx = input.fx_rate != null ? new Decimal(input.fx_rate) : null
  const usdInArs = usd.gt(0) && fx ? usd.mul(fx) : new Decimal(0)
  const total = ars.plus(usdInArs)
  return {
    amount_ars: ars.toFixed(2),
    amount_usd: usd.toFixed(2),
    fx_rate: fx ? fx.toFixed(6) : null,
    amount_ars_total: total.toFixed(2),
    balance: total.toFixed(2),
  }
}

export async function listCreditCards(query: CreditCardQuery, orgId: string) {
  ensureExpensesBranchAssociations()
  const { page, limit, search, is_active } = query
  const { offset } = paginate(page, limit)
  const where: WhereOptions = { org_id: orgId }
  if (is_active !== undefined) Object.assign(where, { is_active })
  if (search) {
    Object.assign(where, {
      [Op.or]: [
        { name: { [Op.iLike]: `%${search}%` } },
        { last_four: { [Op.iLike]: `%${search}%` } },
      ],
    })
  }

  const { default: Branch } = await import('@/modules/auth/branch.model')
  const { default: Contact } = await import('@/modules/contacts/contact.model')

  const { rows, count } = await CreditCard.findAndCountAll({
    where,
    limit,
    offset,
    order: [['name', 'ASC']],
    include: [
      { model: Branch, as: 'branch', attributes: ['id', 'name', 'branch_code'], required: false },
      { model: Contact, as: 'contact', attributes: ['id', 'legal_name'], required: false },
    ],
  })
  return toPaginated(rows, count, page, limit)
}

export async function getCreditCard(id: string, orgId: string) {
  ensureExpensesBranchAssociations()
  const { default: Branch } = await import('@/modules/auth/branch.model')
  const { default: Contact } = await import('@/modules/contacts/contact.model')

  const card = await CreditCard.findOne({
    where: { id, org_id: orgId },
    include: [
      { model: Branch, as: 'branch', attributes: ['id', 'name', 'branch_code'], required: false },
      { model: Contact, as: 'contact', attributes: ['id', 'legal_name'], required: false },
      {
        model: CreditCardStatement,
        as: 'statements',
        required: false,
        separate: true,
        order: [['closing_date', 'DESC']],
        limit: 24,
        include: [
          { model: Expense, as: 'expense', attributes: ['id', 'status', 'paid_amount', 'balance'], required: false },
        ],
      },
    ],
  })
  if (!card) throw new Error('CREDIT_CARD_NOT_FOUND')
  return card
}

export async function createCreditCard(input: CreditCardInput, orgId: string, actorId: string) {
  const card = await CreditCard.create({
    ...input,
    org_id: orgId,
    created_by: actorId,
    updated_by: actorId,
  })
  logger.info({ creditCardId: card.id, orgId }, 'credit card created')
  return card
}

export async function updateCreditCard(
  id: string,
  input: CreditCardUpdateInput,
  orgId: string,
  actorId: string,
) {
  const card = await CreditCard.findOne({ where: { id, org_id: orgId } })
  if (!card) throw new Error('CREDIT_CARD_NOT_FOUND')
  await card.update({ ...input, updated_by: actorId })
  return card
}

export async function listCreditCardStatements(query: CreditCardStatementQuery, orgId: string) {
  const { page, limit, credit_card_id, status } = query
  const { offset } = paginate(page, limit)
  const where: WhereOptions = { org_id: orgId }
  if (credit_card_id) Object.assign(where, { credit_card_id })
  if (status) Object.assign(where, { status })

  const { rows, count } = await CreditCardStatement.findAndCountAll({
    where,
    limit,
    offset,
    order: [['due_date', 'DESC']],
    include: [{ model: CreditCard, as: 'credit_card', attributes: ['id', 'name', 'last_four'] }],
  })
  return toPaginated(rows, count, page, limit)
}

/**
 * Creates a monthly statement and a linked one-off expense for the ARS payable total.
 * USD is converted with the FX rate captured at statement time (variable month to month).
 * The expense is confirmed immediately so it posts to accounting and appears in payables.
 */
export async function createCreditCardStatement(
  input: CreditCardStatementInput,
  orgId: string,
  actorId: string,
) {
  return sequelize.transaction(async (t) => {
    const card = await CreditCard.findOne({
      where: { id: input.credit_card_id, org_id: orgId },
      transaction: t,
      lock: true,
    })
    if (!card) throw new Error('CREDIT_CARD_NOT_FOUND')
    if (!card.is_active) throw new Error('CREDIT_CARD_INACTIVE')
    if (!card.contact_id) throw new Error('CREDIT_CARD_CONTACT_REQUIRED')

    const totals = computeStatementTotals(input)
    if (new Decimal(totals.amount_ars_total).lte(0)) {
      throw new Error('CREDIT_CARD_STATEMENT_AMOUNT_REQUIRED')
    }

    const docNumber = await nextExpenseDocNumber(orgId, card.branch_id, 'expense', t)
    const expenseTotals = calcExpenseTotals(totals.amount_ars_total, '0.00', '0' as IvaRate)
    const notes = [
      input.notes,
      input.amount_usd > 0 ? `USD ${totals.amount_usd} @ ${totals.fx_rate}` : null,
    ].filter(Boolean).join(' · ') || null

    const expense = await Expense.create(
      {
        org_id: orgId,
        branch_id: card.branch_id,
        contact_id: card.contact_id,
        kind: 'one_off',
        expense_number: docNumber,
        description: `Resumen ${card.name}${card.last_four ? ` ····${card.last_four}` : ''} — ${input.period_label}`,
        expense_account_code: card.expense_account_code,
        invoice_date: input.closing_date,
        due_date: input.due_date,
        iva_rate: '0' as IvaRate,
        currency: 'ARS',
        notes,
        status: 'received',
        buyer_id: actorId,
        paid_amount: '0.00',
        balance: expenseTotals.total,
        created_by: actorId,
        updated_by: actorId,
        ...expenseTotals,
      },
      { transaction: t },
    )

    const statement = await CreditCardStatement.create(
      {
        org_id: orgId,
        branch_id: card.branch_id,
        credit_card_id: card.id,
        expense_id: expense.id,
        period_label: input.period_label,
        closing_date: input.closing_date,
        due_date: input.due_date,
        status: 'received',
        notes: input.notes ?? null,
        paid_amount: '0.00',
        created_by: actorId,
        updated_by: actorId,
        ...totals,
      },
      { transaction: t },
    )

    const ctx: TenantContext = {
      orgId,
      userId: actorId,
      defaultBranchId: null,
      allowedBranchIds: [],
    }
    await postExpenseAccounting(expense.id, ctx, t)

    logger.info(
      { statementId: statement.id, expenseId: expense.id, creditCardId: card.id, orgId },
      'credit card statement created',
    )
    return statement
  })
}

/**
 * Corrects the amounts (ARS / USD / cotización) of an existing statement.
 * Only allowed while the linked expense has no payments. Updates the statement,
 * the linked expense totals, and redoes the journal entry (reversal + fresh
 * post) so the payable matches the new total.
 */
export async function updateCreditCardStatementAmounts(
  statementId: string,
  input: CreditCardStatementAmountsInput,
  orgId: string,
  actorId: string,
) {
  return sequelize.transaction(async (t) => {
    const statement = await CreditCardStatement.findOne({
      where: { id: statementId, org_id: orgId },
      transaction: t,
      lock: true,
    })
    if (!statement) throw new Error('STATEMENT_NOT_FOUND')
    if (statement.status === 'cancelled') throw new Error('STATEMENT_CANCELLED')
    if (!statement.expense_id) throw new Error('EXPENSE_NOT_FOUND')

    const expense = await Expense.findOne({
      where: { id: statement.expense_id, org_id: orgId },
      transaction: t,
      lock: true,
    })
    if (!expense) throw new Error('EXPENSE_NOT_FOUND')
    if (expense.status === 'paid' || expense.status === 'cancelled') {
      throw new Error('STATEMENT_LOCKED')
    }

    const paymentsCount = await ExpensePayment.count({
      where: { expense_id: expense.id, deleted_at: null },
      transaction: t,
    })
    if (paymentsCount > 0) throw new Error('STATEMENT_HAS_PAYMENTS')

    const totals = computeStatementTotals(input)
    if (new Decimal(totals.amount_ars_total).lte(0)) {
      throw new Error('CREDIT_CARD_STATEMENT_AMOUNT_REQUIRED')
    }

    const expenseTotals = calcExpenseTotals(totals.amount_ars_total, '0.00', '0' as IvaRate)
    const notes = [
      statement.notes,
      input.amount_usd > 0 ? `USD ${totals.amount_usd} @ ${totals.fx_rate}` : null,
    ].filter(Boolean).join(' · ') || null

    await expense.update(
      {
        ...expenseTotals,
        balance: expenseTotals.total,
        notes,
        updated_by: actorId,
      },
      { transaction: t },
    )
    await statement.update(
      {
        ...totals,
        updated_by: actorId,
      },
      { transaction: t },
    )

    const ctx: TenantContext = { orgId, userId: actorId, defaultBranchId: null, allowedBranchIds: [] }
    await reverseExpenseAccounting(expense.id, expense.branch_id, ctx, t)
    await postExpenseAccounting(expense.id, ctx, t)

    logger.info(
      { statementId, expenseId: expense.id, orgId, total: totals.amount_ars_total },
      'credit card statement amounts updated',
    )
    return statement
  })
}
