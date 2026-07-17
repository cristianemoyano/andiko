import 'server-only'
import { Op } from 'sequelize'
import Decimal from 'decimal.js'
import { paginate, toPaginated } from '@/lib/pagination'
import { whereAllowedBranches, whereOrg, type TenantContext } from '@/lib/tenancy'
import Contact from '@/modules/contacts/contact.model'
import Expense from './expense.model'
import ExpensePayment from './expense-payment.model'
import type { AccountStatementQuery } from '@/modules/sales/account-statement.schema'

/** Estados de gasto que no generan movimientos en la cuenta corriente. */
const EXCLUDED_EXPENSE_STATUSES = ['draft', 'cancelled'] as const

export type ExpenseSupplierStatementLine = {
  id: string
  movement_type: 'invoice' | 'payment'
  movement_id: string
  related_id: string | null
  date: string
  document_number: string
  description: string | null
  due_date: string | null
  debit: string
  credit: string
  running_balance: string
}

export type ExpenseSupplierStatementSummary = {
  currency: string
  total_invoiced: string
  total_paid: string
  balance: string
  overdue_balance: string
  current_balance: string
  debt_status: 'up_to_date' | 'with_balance' | 'overdue'
}

type MovementDraft = {
  id: string
  movement_type: 'invoice' | 'payment'
  movement_id: string
  related_id: string | null
  date: Date
  document_number: string
  description: string | null
  due_date: Date | null
  debit: Decimal
  credit: Decimal
}

/**
 * Cuenta corriente de un proveedor de expensas: gastos (debe = `total`) y pagos
 * (haber = `amount`), con saldo inicial, saldo corrido y resumen (facturado/pagado/
 * saldo/vencido). Excluye gastos en borrador o anulados.
 */
export async function getExpenseSupplierAccountStatement(contactId: string, query: AccountStatementQuery, ctx: TenantContext) {
  const contact = await Contact.findOne({
    where: whereOrg(ctx, { id: contactId }),
    attributes: ['id', 'legal_name', 'trade_name'],
  })
  if (!contact) throw new Error('CONTACT_NOT_FOUND')

  const expenses = await Expense.findAll({
    where: whereAllowedBranches(ctx, {
      contact_id: contactId,
      status: { [Op.notIn]: [...EXCLUDED_EXPENSE_STATUSES] },
    }),
    attributes: ['id', 'expense_number', 'description', 'status', 'invoice_date', 'due_date', 'created_at', 'total', 'paid_amount', 'balance', 'currency'],
    order: [['invoice_date', 'ASC'], ['created_at', 'ASC']],
  })

  const summary = buildSummary(expenses)
  if (query.summary_only) {
    return {
      contact: {
        id: String(contact.id),
        legal_name: String(contact.legal_name),
        trade_name: contact.trade_name ? String(contact.trade_name) : null,
      },
      summary,
      ...toPaginated<ExpenseSupplierStatementLine>([], 0, query.page, query.limit),
    }
  }

  const expenseIds = expenses.map((e) => String(e.id))
  const payments = await ExpensePayment.findAll({
    where: whereAllowedBranches(ctx, {
      expense_id: { [Op.in]: expenseIds.length > 0 ? expenseIds : ['00000000-0000-0000-0000-000000000000'] },
    }),
    attributes: ['id', 'expense_id', 'payment_number', 'payment_date', 'amount', 'notes'],
    include: [{ model: Expense, as: 'expense', attributes: ['id', 'status'], required: false }],
    order: [['payment_date', 'ASC'], ['created_at', 'ASC']],
  })

  const from = query.from ? atStartOfDay(query.from) : null
  const to = query.to ? atEndOfDay(query.to) : null
  const search = query.search?.trim().toLowerCase() ?? ''

  const allMovements = buildMovements(expenses, payments)
  const openingBalance = allMovements
    .filter(m => (from ? m.date < from : false))
    .reduce((acc, m) => acc.plus(m.debit).minus(m.credit), new Decimal(0))

  const filteredMovements = allMovements.filter(m => {
    if (from && m.date < from) return false
    if (to && m.date > to) return false
    if (query.movement_type && m.movement_type !== query.movement_type) return false
    if (!search) return true

    const haystack = [m.document_number, m.description ?? ''].join(' ').toLowerCase()
    return haystack.includes(search)
  })

  let runningBalance = openingBalance
  const linesWithBalanceAsc: ExpenseSupplierStatementLine[] = filteredMovements.map(m => {
    runningBalance = runningBalance.plus(m.debit).minus(m.credit)
    return {
      id: m.id,
      movement_type: m.movement_type,
      movement_id: m.movement_id,
      related_id: m.related_id,
      date: m.date.toISOString(),
      document_number: m.document_number,
      description: m.description,
      due_date: m.due_date ? m.due_date.toISOString() : null,
      debit: m.debit.toFixed(2),
      credit: m.credit.toFixed(2),
      running_balance: runningBalance.toFixed(2),
    }
  })

  const linesWithBalance = linesWithBalanceAsc.reverse()

  const { offset } = paginate(query.page, query.limit)
  const pagedLines = linesWithBalance.slice(offset, offset + query.limit)

  return {
    contact: {
      id: String(contact.id),
      legal_name: String(contact.legal_name),
      trade_name: contact.trade_name ? String(contact.trade_name) : null,
    },
    summary,
    ...toPaginated(pagedLines, linesWithBalance.length, query.page, query.limit),
  }
}

function isExcludedStatus(status: unknown): boolean {
  return status === 'draft' || status === 'cancelled'
}

function buildSummary(expenses: Expense[]): ExpenseSupplierStatementSummary {
  const today = new Date()
  let totalInvoiced = new Decimal(0)
  let totalPaid = new Decimal(0)
  let balance = new Decimal(0)
  let overdueBalance = new Decimal(0)
  let currentBalance = new Decimal(0)

  const currency = expenses[0]?.currency ? String(expenses[0].currency) : 'ARS'
  for (const expense of expenses) {
    if (isExcludedStatus(expense.status)) continue
    totalInvoiced = totalInvoiced.plus(parseDecimal(expense.total))
    totalPaid = totalPaid.plus(parseDecimal(expense.paid_amount))
    const expenseBalance = parseDecimal(expense.balance)
    balance = balance.plus(expenseBalance)

    const isOpen = expenseBalance.gt(0)
    if (!isOpen) continue
    const dueDate = expense.due_date ? new Date(expense.due_date) : null
    if (dueDate && dueDate < today) {
      overdueBalance = overdueBalance.plus(expenseBalance)
    } else {
      currentBalance = currentBalance.plus(expenseBalance)
    }
  }

  let debtStatus: ExpenseSupplierStatementSummary['debt_status'] = 'up_to_date'
  if (overdueBalance.gt(0)) debtStatus = 'overdue'
  else if (balance.gt(0)) debtStatus = 'with_balance'

  return {
    currency,
    total_invoiced: totalInvoiced.toFixed(2),
    total_paid: totalPaid.toFixed(2),
    balance: balance.toFixed(2),
    overdue_balance: overdueBalance.toFixed(2),
    current_balance: currentBalance.toFixed(2),
    debt_status: debtStatus,
  }
}

function buildMovements(expenses: Expense[], payments: ExpensePayment[]): MovementDraft[] {
  const expenseMovements: MovementDraft[] = expenses
    .filter(e => !isExcludedStatus(e.status))
    .map(expense => ({
      id: `invoice:${expense.id}`,
      movement_type: 'invoice',
      movement_id: String(expense.id),
      related_id: null,
      date: expense.invoice_date ? new Date(expense.invoice_date) : new Date(expense.created_at),
      document_number: String(expense.expense_number),
      description: expense.description ? String(expense.description) : null,
      due_date: expense.due_date ? new Date(expense.due_date) : null,
      debit: parseDecimal(expense.total),
      credit: new Decimal(0),
    }))

  const paymentMovements: MovementDraft[] = payments
    .filter((payment) => {
      const expenseStatus = (payment as ExpensePayment & { expense?: { status?: string } | null }).expense?.status
      return !isExcludedStatus(expenseStatus)
    })
    .map(payment => ({
      id: `payment:${payment.id}`,
      movement_type: 'payment',
      movement_id: String(payment.id),
      related_id: String(payment.expense_id),
      date: new Date(payment.payment_date),
      document_number: String(payment.payment_number),
      description: payment.notes ? String(payment.notes) : null,
      due_date: null,
      debit: new Decimal(0),
      credit: parseDecimal(payment.amount),
    }))

  return [...expenseMovements, ...paymentMovements].sort((a, b) => {
    const dayCompare = toUtcDayKey(a.date).localeCompare(toUtcDayKey(b.date))
    if (dayCompare !== 0) return dayCompare

    if (a.movement_type !== b.movement_type) return a.movement_type === 'invoice' ? -1 : 1

    const dateCompare = a.date.getTime() - b.date.getTime()
    if (dateCompare !== 0) return dateCompare

    return a.document_number.localeCompare(b.document_number, 'es', { numeric: true })
  })
}

function toUtcDayKey(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDecimal(value: unknown): Decimal {
  return new Decimal(String(value ?? '0'))
}

function atStartOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function atEndOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}
