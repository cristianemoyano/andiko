import 'server-only'
import { Op } from 'sequelize'
import Decimal from 'decimal.js'
import { paginate, toPaginated } from '@/lib/pagination'
import { whereAllowedBranches, whereOrg, type TenantContext } from '@/lib/tenancy'
import { FISCAL_NUMBER_SOURCE_ATTRS, resolveSalesDocumentDisplay } from '@/lib/fiscal-document-number'
import Contact from '@/modules/contacts/contact.model'
import Invoice from './invoice.model'
import Payment from './payment.model'
import CreditNote from './credit-note.model'
import SalesOrder from './sales-order.model'
import type { AccountStatementQuery, AccountStatementMovementType } from './account-statement.schema'

export type AccountStatementLine = {
  id: string
  movement_type: AccountStatementMovementType
  movement_id: string
  date: string
  document_number: string
  description: string | null
  due_date: string | null
  debit: string
  credit: string
  running_balance: string
}

export type AccountStatementSummary = {
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
  movement_type: AccountStatementMovementType
  movement_id: string
  date: Date
  document_number: string
  description: string | null
  due_date: Date | null
  debit: Decimal
  credit: Decimal
}

export async function getAccountStatement(contactId: string, query: AccountStatementQuery, ctx: TenantContext) {
  const contact = await Contact.findOne({
    where: whereOrg(ctx, { id: contactId }),
    attributes: ['id', 'legal_name', 'trade_name'],
  })
  if (!contact) throw new Error('CONTACT_NOT_FOUND')

  const invoices = await Invoice.findAll({
    where: whereAllowedBranches(ctx, {
      contact_id: contactId,
      status: { [Op.notIn]: ['cancelled'] },
    }),
    attributes: [
      'id', 'invoice_number', 'status', 'issue_date', 'due_date', 'created_at', 'total', 'paid_amount', 'balance', 'currency', 'notes',
      ...FISCAL_NUMBER_SOURCE_ATTRS,
    ],
    order: [['issue_date', 'ASC'], ['created_at', 'ASC']],
  })

  const summary = buildSummary(invoices)
  if (query.summary_only) {
    return {
      contact: {
        id: String(contact.id),
        legal_name: String(contact.legal_name),
        trade_name: contact.trade_name ? String(contact.trade_name) : null,
      },
      summary,
      ...toPaginated<AccountStatementLine>([], 0, query.page, query.limit),
    }
  }

  const invoiceIds = invoices.map((invoice) => String(invoice.id))
  const payments = await Payment.findAll({
    where: whereAllowedBranches(ctx, {
      invoice_id: { [Op.in]: invoiceIds.length > 0 ? invoiceIds : ['00000000-0000-0000-0000-000000000000'] },
    }),
    attributes: ['id', 'invoice_id', 'payment_number', 'payment_date', 'amount', 'reference', 'notes'],
    include: [{ model: Invoice, as: 'invoice', attributes: ['id', 'status'], required: false }],
    order: [['payment_date', 'ASC'], ['created_at', 'ASC']],
  })

  const creditNotes = await CreditNote.findAll({
    where: whereAllowedBranches(ctx, {
      contact_id: contactId,
      status: 'issued',
    }),
    attributes: ['id', 'credit_note_number', 'issue_date', 'total', 'reason', 'created_at', ...FISCAL_NUMBER_SOURCE_ATTRS],
    order: [['issue_date', 'ASC'], ['created_at', 'ASC']],
  })

  const SalesRefund = (await import('./sales-refund.model')).default
  const SalesReturn = (await import('./sales-return.model')).default
  const { ensureSalesReturnAssociations } = await import('./sales-returns.service')
  ensureSalesReturnAssociations()
  const refunds = await SalesRefund.findAll({
    where: whereAllowedBranches(ctx, {}),
    attributes: ['id', 'refund_number', 'refund_date', 'amount', 'reference', 'notes', 'return_id'],
    include: [{
      model: SalesReturn,
      as: 'salesReturn',
      attributes: ['id', 'order_id'],
      required: true,
      include: [{
        model: SalesOrder,
        as: 'order',
        attributes: ['id', 'contact_id'],
        where: { contact_id: contactId },
        required: true,
      }],
    }],
    order: [['refund_date', 'ASC'], ['created_at', 'ASC']],
  })

  const from = query.from ? atStartOfDay(query.from) : null
  const to = query.to ? atEndOfDay(query.to) : null
  const search = query.search?.trim().toLowerCase() ?? ''

  const allMovements = buildMovements(invoices, payments, creditNotes, refunds)
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
  const linesWithBalance: AccountStatementLine[] = filteredMovements.map(m => {
    runningBalance = runningBalance.plus(m.debit).minus(m.credit)
    return {
      id: m.id,
      movement_type: m.movement_type,
      movement_id: m.movement_id,
      date: m.date.toISOString(),
      document_number: m.document_number,
      description: m.description,
      due_date: m.due_date ? m.due_date.toISOString() : null,
      debit: m.debit.toFixed(2),
      credit: m.credit.toFixed(2),
      running_balance: runningBalance.toFixed(2),
    }
  })

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

function buildSummary(invoices: Invoice[]) {
  const today = new Date()
  let totalInvoiced = new Decimal(0)
  let totalPaid = new Decimal(0)
  let balance = new Decimal(0)
  let overdueBalance = new Decimal(0)
  let currentBalance = new Decimal(0)

  const currency = invoices[0]?.currency ? String(invoices[0].currency) : 'ARS'
  for (const invoice of invoices) {
    if (invoice.status === 'cancelled') continue
    totalInvoiced = totalInvoiced.plus(parseDecimal(invoice.total))
    totalPaid = totalPaid.plus(parseDecimal(invoice.paid_amount))
    const invoiceBalance = parseDecimal(invoice.balance)
    balance = balance.plus(invoiceBalance)

    const isOpen = invoiceBalance.gt(0)
    if (!isOpen) continue
    const dueDate = invoice.due_date ? new Date(invoice.due_date) : null
    if (dueDate && dueDate < today) {
      overdueBalance = overdueBalance.plus(invoiceBalance)
    } else {
      currentBalance = currentBalance.plus(invoiceBalance)
    }
  }

  let debtStatus: AccountStatementSummary['debt_status'] = 'up_to_date'
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
  } satisfies AccountStatementSummary
}

function buildMovements(
  invoices: Invoice[],
  payments: Payment[],
  creditNotes: CreditNote[],
  refunds: Array<{ id: string; refund_number: string; refund_date: Date; amount: string; reference: string | null; notes: string | null }>,
): MovementDraft[] {
  const invoiceMovements: MovementDraft[] = invoices
    .filter(i => i.status !== 'cancelled')
    .map(invoice => ({
      id: `invoice:${invoice.id}`,
      movement_type: 'invoice',
      movement_id: String(invoice.id),
      date: invoice.issue_date ? new Date(invoice.issue_date) : new Date(invoice.created_at),
      document_number: resolveSalesDocumentDisplay({
        internalNumber: String(invoice.invoice_number),
        afip_status: invoice.afip_status,
        punto_venta: invoice.punto_venta,
        cbte_numero: invoice.cbte_numero,
      }).primary,
      description: invoice.notes ? String(invoice.notes) : null,
      due_date: invoice.due_date ? new Date(invoice.due_date) : null,
      debit: parseDecimal(invoice.total),
      credit: new Decimal(0),
    }))

  const paymentMovements: MovementDraft[] = payments
    .filter((payment) => {
      const invoiceStatus = (payment as Payment & { invoice?: { status?: string } | null }).invoice?.status
      return invoiceStatus !== 'cancelled'
    })
    .map(payment => ({
      id: `payment:${payment.id}`,
      movement_type: 'payment',
      movement_id: String(payment.id),
      date: new Date(payment.payment_date),
      document_number: String(payment.payment_number),
      description: payment.reference ? String(payment.reference) : (payment.notes ? String(payment.notes) : null),
      due_date: null,
      debit: new Decimal(0),
      credit: parseDecimal(payment.amount),
    }))

  const creditNoteMovements: MovementDraft[] = creditNotes.map(cn => ({
    id: `credit_note:${cn.id}`,
    movement_type: 'credit_note' as AccountStatementMovementType,
    movement_id: String(cn.id),
    date: cn.issue_date ? new Date(cn.issue_date) : new Date(cn.created_at),
    document_number: resolveSalesDocumentDisplay({
      internalNumber: String(cn.credit_note_number),
      afip_status: cn.afip_status,
      punto_venta: cn.punto_venta,
      cbte_numero: cn.cbte_numero,
    }).primary,
    description: cn.reason ? String(cn.reason) : null,
    due_date: null,
    debit: new Decimal(0),
    credit: parseDecimal(cn.total),
  }))

  const refundMovements: MovementDraft[] = refunds.map(r => ({
    id: `refund:${r.id}`,
    movement_type: 'refund' as AccountStatementMovementType,
    movement_id: String(r.id),
    date: new Date(r.refund_date),
    document_number: String(r.refund_number),
    description: r.reference ? String(r.reference) : (r.notes ? String(r.notes) : 'Reembolso'),
    due_date: null,
    debit: new Decimal(0),
    credit: parseDecimal(r.amount),
  }))

  return [...invoiceMovements, ...paymentMovements, ...creditNoteMovements, ...refundMovements].sort((a, b) => {
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
