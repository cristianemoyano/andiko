import 'server-only'
import type { PaymentCondition } from '@/types'
import type { PrintableBranch, PrintableCounterparty, PrintableDocument, PrintableLineItem, PrintablePaymentRow, PrintableTotals } from '@/types/printing'
import type { TenantContext } from '@/lib/tenancy'
import { getQuote } from '@/modules/sales/sales-quotes.service'
import { getOrder } from '@/modules/sales/sales-orders.service'
import { getInvoice } from '@/modules/sales/invoices.service'
import { decString, formatDateArg } from './format-utils'
import { getIssuerName } from './issuer'
import { assertPrintAccess } from './tenant-guards'
import {
  INVOICE_STATUS_LABEL,
  ORDER_STATUS_LABEL,
  PAYMENT_CONDITION_LABEL,
  QUOTE_STATUS_LABEL,
  labelSalesPaymentMethod,
} from './labels'

/** Sequelize include fields not declared on model class. */
type BranchInc = { id: string; name: string; branch_code: number }
type ContactInc = { legal_name: string; trade_name: string | null }

type SalesQuoteLoaded = {
  status: string
  quote_number: string
  payment_condition: PaymentCondition
  currency: string
  notes: string | null
  valid_until: Date | null
  created_at: Date
  subtotal: unknown
  discount_amount: unknown
  tax_amount: unknown
  total: unknown
  branch?: BranchInc | null
  contact?: ContactInc | null
  items?: Parameters<typeof linesFromSalesLikeItems>[0]
}

type SalesOrderLoaded = {
  status: string
  order_number: string
  payment_condition: PaymentCondition
  currency: string
  notes: string | null
  created_at: Date
  promised_date: Date | null
  delivered_date: Date | null
  subtotal: unknown
  discount_amount: unknown
  tax_amount: unknown
  total: unknown
  branch?: BranchInc | null
  contact?: ContactInc | null
  items?: Parameters<typeof linesFromSalesLikeItems>[0]
}

type SalesInvoiceLoaded = {
  status: string
  org_id: string | null
  branch_id: string | null
  invoice_number: string
  payment_condition: PaymentCondition
  currency: string
  notes: string | null
  created_at: Date
  issue_date: Date | null
  due_date: Date | null
  subtotal: unknown
  discount_amount: unknown
  tax_amount: unknown
  total: unknown
  branch?: BranchInc | null
  contact?: ContactInc | null
  items?: Parameters<typeof linesFromSalesLikeItems>[0]
  payments?: Array<{
    payment_number: string
    payment_date: Date
    amount: string
    payment_method: string
    reference: string | null
  }>
}

function branchFromModel(b: { id: string; name: string; branch_code: number } | null | undefined): PrintableBranch | null {
  if (!b) return null
  return { id: b.id, name: b.name, branch_code: b.branch_code }
}

function counterpartyFromContact(c: { legal_name: string; trade_name: string | null } | null | undefined): PrintableCounterparty | null {
  if (!c) return null
  return { legal_name: c.legal_name, trade_name: c.trade_name ?? null }
}

function linesFromSalesLikeItems(items: Array<{
  description: string
  quantity: unknown
  unit_price: unknown
  discount_pct: unknown
  iva_rate: string
  subtotal: unknown
  discount_amount: unknown
  tax_amount: unknown
  total: unknown
}> | undefined): PrintableLineItem[] {
  if (!items?.length) return []
  return items.map(i => ({
    description: i.description,
    quantity: decString(i.quantity),
    unit_price: decString(i.unit_price),
    discount_pct: decString(i.discount_pct),
    iva_rate: i.iva_rate as PrintableLineItem['iva_rate'],
    subtotal: decString(i.subtotal),
    discount_amount: decString(i.discount_amount),
    tax_amount: decString(i.tax_amount),
    total: decString(i.total),
  }))
}

function totalsFrom(subtotal: unknown, discount: unknown | null, tax: unknown, total: unknown): PrintableTotals {
  return {
    subtotal: decString(subtotal),
    discount_amount: discount == null ? null : decString(discount),
    tax_amount: decString(tax),
    total: decString(total),
  }
}

export async function buildSalesQuotePrintable(id: string, ctx: TenantContext): Promise<PrintableDocument> {
  const quote = (await getQuote(id, ctx)) as unknown as SalesQuoteLoaded
  const issuerName = await getIssuerName(ctx.orgId)
  const pc = quote.payment_condition as PaymentCondition
  const isDraft = quote.status === 'draft'
  return {
    domain: 'sales',
    kind: 'sales_quote',
    isDraft,
    issuer: { name: issuerName },
    title: 'Presupuesto',
    document_number: quote.quote_number,
    status_code: quote.status,
    status_label: QUOTE_STATUS_LABEL[quote.status] ?? quote.status,
    currency: quote.currency,
    payment_condition: pc,
    payment_condition_label: PAYMENT_CONDITION_LABEL[pc] ?? null,
    counterparty_role: 'customer',
    counterparty: counterpartyFromContact(quote.contact),
    branch: branchFromModel(quote.branch),
    meta_dates: [
      { label: 'Emisión', value: formatDateArg(quote.created_at) },
      { label: 'Válido hasta', value: formatDateArg(quote.valid_until) },
    ],
    lines: linesFromSalesLikeItems(quote.items),
    totals: totalsFrom(quote.subtotal, quote.discount_amount, quote.tax_amount, quote.total),
    notes: quote.notes ?? null,
    payments: null,
  }
}

export async function buildSalesOrderPrintable(id: string, ctx: TenantContext): Promise<PrintableDocument> {
  const order = (await getOrder(id, ctx)) as unknown as SalesOrderLoaded
  const issuerName = await getIssuerName(ctx.orgId)
  const pc = order.payment_condition as PaymentCondition
  const isDraft = order.status === 'draft'
  return {
    domain: 'sales',
    kind: 'sales_order',
    isDraft,
    issuer: { name: issuerName },
    title: 'Pedido',
    document_number: order.order_number,
    status_code: order.status,
    status_label: ORDER_STATUS_LABEL[order.status] ?? order.status,
    currency: order.currency,
    payment_condition: pc,
    payment_condition_label: PAYMENT_CONDITION_LABEL[pc] ?? null,
    counterparty_role: 'customer',
    counterparty: counterpartyFromContact(order.contact),
    branch: branchFromModel(order.branch),
    meta_dates: [
      { label: 'Emisión', value: formatDateArg(order.created_at) },
      { label: 'Prometido', value: formatDateArg(order.promised_date) },
      { label: 'Entregado', value: formatDateArg(order.delivered_date) },
    ],
    lines: linesFromSalesLikeItems(order.items),
    totals: totalsFrom(order.subtotal, order.discount_amount, order.tax_amount, order.total),
    notes: order.notes ?? null,
    payments: null,
  }
}

export async function buildSalesInvoicePrintable(id: string, ctx: TenantContext): Promise<PrintableDocument> {
  const invoice = (await getInvoice(id, ctx)) as unknown as SalesInvoiceLoaded
  assertPrintAccess({ org_id: invoice.org_id, branch_id: invoice.branch_id }, ctx)
  const issuerName = await getIssuerName(ctx.orgId)
  const pc = invoice.payment_condition as PaymentCondition
  const isDraft = invoice.status === 'draft'
  const payments: PrintablePaymentRow[] | null = (() => {
    const raw = invoice.payments
    if (!raw?.length) return null
    return raw.map(p => ({
      payment_number: p.payment_number,
      payment_date: formatDateArg(p.payment_date) ?? '',
      amount: decString(p.amount),
      payment_method: labelSalesPaymentMethod(p.payment_method),
      reference: p.reference,
    }))
  })()
  return {
    domain: 'sales',
    kind: 'sales_invoice',
    isDraft,
    issuer: { name: issuerName },
    title: 'Factura',
    document_number: invoice.invoice_number,
    status_code: invoice.status,
    status_label: INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status,
    currency: invoice.currency,
    payment_condition: pc,
    payment_condition_label: PAYMENT_CONDITION_LABEL[pc] ?? null,
    counterparty_role: 'customer',
    counterparty: counterpartyFromContact(invoice.contact),
    branch: branchFromModel(invoice.branch),
    meta_dates: [
      { label: 'Emisión', value: formatDateArg(invoice.created_at) },
      { label: 'Fecha emisión', value: formatDateArg(invoice.issue_date) },
      { label: 'Vencimiento', value: formatDateArg(invoice.due_date) },
    ],
    lines: linesFromSalesLikeItems(invoice.items),
    totals: totalsFrom(invoice.subtotal, invoice.discount_amount, invoice.tax_amount, invoice.total),
    notes: invoice.notes ?? null,
    payments,
  }
}
