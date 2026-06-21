import 'server-only'
import QRCode from 'qrcode'
import type { PaymentCondition } from '@/types'
import type { PrintableAfip, PrintableBranch, PrintableCounterparty, PrintableDocument, PrintableLineItem, PrintablePaymentRow, PrintableTotals } from '@/types/printing'
import type { TenantContext } from '@/lib/tenancy'
import { getQuote } from '@/modules/sales/sales-quotes.service'
import { getOrder } from '@/modules/sales/sales-orders.service'
import { getInvoice } from '@/modules/sales/invoices.service'
import { getCreditNote } from '@/modules/sales/credit-notes.service'
import { getDebitNote } from '@/modules/sales/debit-notes.service'
import { getDeliveryNote } from '@/modules/inventory/delivery-notes.service'
import { buildAfipQrUrl } from '@/modules/afip/afip-qr'
import { decString, formatDateArg } from './format-utils'
import { getPrintHeader } from './issuer'
import { assertPrintAccess } from './tenant-guards'
import {
  CREDIT_NOTE_STATUS_LABEL,
  DEBIT_NOTE_STATUS_LABEL,
  DELIVERY_NOTE_STATUS_LABEL,
  INVOICE_STATUS_LABEL,
  ORDER_STATUS_LABEL,
  PAYMENT_CONDITION_LABEL,
  QUOTE_STATUS_LABEL,
  labelSalesPaymentMethod,
} from './labels'

/** Sequelize include fields not declared on model class. */
type BranchInc = { id: string; name: string; branch_code: number }
type ContactInc = { legal_name: string; trade_name: string | null; cuit?: string | null }

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
  cae: string | null
  cae_expiration: Date | string | null
  comprobante_tipo: number | null
  punto_venta: number | null
  cbte_numero: number | null
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

type DeliveryNoteLoaded = {
  org_id: string | null
  branch_id: string | null
  status: string
  delivery_number: string
  carrier: string | null
  tracking_code: string | null
  notes: string | null
  created_at: Date
  delivery_date: Date | null
  branch?: BranchInc | null
  contact?: ContactInc | null
  items?: Array<{ description: string; quantity: unknown }>
}

type SalesCreditNoteLoaded = {
  status: string
  org_id: string | null
  branch_id: string | null
  credit_note_number: string
  currency: string
  notes: string | null
  reason: string | null
  created_at: Date
  issue_date: Date | string | null
  subtotal: unknown
  discount_amount: unknown
  tax_amount: unknown
  total: unknown
  cae: string | null
  cae_expiration: Date | string | null
  comprobante_tipo: number | null
  punto_venta: number | null
  cbte_numero: number | null
  branch?: BranchInc | null
  contact?: ContactInc | null
  invoice?: { invoice_number: string } | null
}

type SalesDebitNoteLoaded = {
  status: string
  org_id: string | null
  branch_id: string | null
  debit_note_number: string
  currency: string
  notes: string | null
  reason: string | null
  created_at: Date
  issue_date: Date | string | null
  subtotal: unknown
  discount_amount: unknown
  tax_amount: unknown
  total: unknown
  cae: string | null
  cae_expiration: Date | string | null
  comprobante_tipo: number | null
  punto_venta: number | null
  cbte_numero: number | null
  branch?: BranchInc | null
  contact?: ContactInc | null
  invoice?: { invoice_number: string } | null
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
  const { issuer, template } = await getPrintHeader(ctx.orgId)
  const pc = quote.payment_condition as PaymentCondition
  const isDraft = quote.status === 'draft'
  return {
    domain: 'sales',
    kind: 'sales_quote',
    isDraft,
    issuer,
    template,
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
  const { issuer, template } = await getPrintHeader(ctx.orgId)
  const pc = order.payment_condition as PaymentCondition
  const isDraft = order.status === 'draft'
  return {
    domain: 'sales',
    kind: 'sales_order',
    isDraft,
    issuer,
    template,
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

export async function buildDeliveryNotePrintable(id: string, ctx: TenantContext): Promise<PrintableDocument> {
  const note = (await getDeliveryNote(id, ctx.orgId)) as unknown as DeliveryNoteLoaded
  assertPrintAccess({ org_id: note.org_id, branch_id: note.branch_id }, ctx)
  const { issuer, template } = await getPrintHeader(ctx.orgId)
  const isDraft = note.status === 'draft'
  const lines: PrintableLineItem[] = (note.items ?? []).map(i => ({
    description: i.description,
    quantity: decString(i.quantity),
    unit_price: '0',
    discount_pct: null,
    iva_rate: null,
    subtotal: null,
    discount_amount: null,
    tax_amount: null,
    total: null,
  }))
  return {
    domain: 'sales',
    kind: 'delivery_note',
    isDraft,
    issuer,
    template,
    title: 'Remito de entrega',
    document_number: note.delivery_number,
    status_code: note.status,
    status_label: DELIVERY_NOTE_STATUS_LABEL[note.status] ?? note.status,
    currency: 'ARS',
    payment_condition: null,
    payment_condition_label: null,
    counterparty_role: 'customer',
    counterparty: counterpartyFromContact(note.contact),
    branch: branchFromModel(note.branch),
    meta_dates: [
      { label: 'Emisión', value: formatDateArg(note.created_at) },
      { label: 'Entrega', value: formatDateArg(note.delivery_date) },
      { label: 'Transportista', value: note.carrier ?? null },
      { label: 'Seguimiento', value: note.tracking_code ?? null },
    ],
    lines,
    totals: { subtotal: '0.00', discount_amount: null, tax_amount: '0.00', total: '0.00' },
    notes: note.notes ?? null,
    payments: null,
  }
}

const COMPROBANTE_TIPO_LABEL: Record<number, string> = {
  1: 'Factura A', 6: 'Factura B', 11: 'Factura C',
  2: 'Nota de Débito A', 7: 'Nota de Débito B', 12: 'Nota de Débito C',
  3: 'Nota de Crédito A', 8: 'Nota de Crédito B', 13: 'Nota de Crédito C',
}

function digitsOnly(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

function isoDateOnly(value: Date | string | null): string | null {
  if (!value) return null
  if (typeof value === 'string') return value.slice(0, 10)
  return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10)
}

/** Builds the AFIP CAE + QR block for an authorized comprobante (server-side QR data-URL). */
async function buildAuthorizedAfip(
  doc: {
    cae: string | null
    cae_expiration: Date | string | null
    comprobante_tipo: number | null
    punto_venta: number | null
    cbte_numero: number | null
    issue_date: Date | string | null
    created_at: Date
    total: unknown
    contact?: ContactInc | null
  },
  issuerCuit: string | null,
): Promise<PrintableAfip | null> {
  if (!doc.cae) return null

  let qrDataUrl: string | null = null
  const issuerDigits = digitsOnly(issuerCuit)
  if (issuerDigits.length === 11 && doc.punto_venta && doc.comprobante_tipo && doc.cbte_numero) {
    const recDigits = digitsOnly(doc.contact?.cuit)
    const receiver = recDigits.length === 11
      ? { tipoDocRec: 80, nroDocRec: Number(recDigits) }
      : { tipoDocRec: 99, nroDocRec: 0 }
    const url = buildAfipQrUrl({
      fecha: isoDateOnly(doc.issue_date) ?? isoDateOnly(doc.created_at) ?? '',
      cuit: Number(issuerDigits),
      ptoVta: doc.punto_venta,
      tipoCmp: doc.comprobante_tipo,
      nroCmp: doc.cbte_numero,
      importe: Number(decString(doc.total)),
      moneda: 'PES',
      ctz: 1,
      tipoDocRec: receiver.tipoDocRec,
      nroDocRec: receiver.nroDocRec,
      codAut: Number(doc.cae),
    })
    try {
      qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 160 })
    } catch {
      qrDataUrl = null
    }
  }

  return {
    cae: doc.cae,
    cae_expiration: isoDateOnly(doc.cae_expiration),
    comprobante_label: doc.comprobante_tipo != null ? (COMPROBANTE_TIPO_LABEL[doc.comprobante_tipo] ?? null) : null,
    punto_venta: doc.punto_venta,
    cbte_numero: doc.cbte_numero,
    qr_data_url: qrDataUrl,
  }
}

export async function buildSalesInvoicePrintable(id: string, ctx: TenantContext): Promise<PrintableDocument> {
  const invoice = (await getInvoice(id, ctx)) as unknown as SalesInvoiceLoaded
  assertPrintAccess({ org_id: invoice.org_id, branch_id: invoice.branch_id }, ctx)
  const { issuer, template } = await getPrintHeader(ctx.orgId)
  const afip = await buildAuthorizedAfip(invoice, issuer.cuit)
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
    issuer,
    template,
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
    afip,
  }
}

export async function buildSalesCreditNotePrintable(id: string, ctx: TenantContext): Promise<PrintableDocument> {
  const note = (await getCreditNote(id, ctx)) as unknown as SalesCreditNoteLoaded
  assertPrintAccess({ org_id: note.org_id, branch_id: note.branch_id }, ctx)
  const { issuer, template } = await getPrintHeader(ctx.orgId)
  const afip = await buildAuthorizedAfip(note, issuer.cuit)
  const isDraft = note.status === 'draft'
  const meta_dates: PrintableDocument['meta_dates'] = [
    { label: 'Emisión', value: formatDateArg(note.created_at) },
    { label: 'Fecha emisión', value: formatDateArg(note.issue_date) },
  ]
  if (note.invoice?.invoice_number) {
    meta_dates.push({ label: 'Factura asociada', value: note.invoice.invoice_number })
  }
  if (note.reason) {
    meta_dates.push({ label: 'Motivo', value: note.reason })
  }
  return {
    domain: 'sales',
    kind: 'sales_credit_note',
    isDraft,
    issuer,
    template,
    title: 'Nota de crédito',
    document_number: note.credit_note_number,
    status_code: note.status,
    status_label: CREDIT_NOTE_STATUS_LABEL[note.status] ?? note.status,
    currency: note.currency,
    payment_condition: null,
    payment_condition_label: null,
    counterparty_role: 'customer',
    counterparty: counterpartyFromContact(note.contact),
    branch: branchFromModel(note.branch),
    meta_dates,
    lines: [],
    totals: totalsFrom(note.subtotal, note.discount_amount, note.tax_amount, note.total),
    notes: note.notes ?? null,
    payments: null,
    afip,
  }
}

export async function buildSalesDebitNotePrintable(id: string, ctx: TenantContext): Promise<PrintableDocument> {
  const note = (await getDebitNote(id, ctx)) as unknown as SalesDebitNoteLoaded
  assertPrintAccess({ org_id: note.org_id, branch_id: note.branch_id }, ctx)
  const { issuer, template } = await getPrintHeader(ctx.orgId)
  const afip = await buildAuthorizedAfip(note, issuer.cuit)
  const isDraft = note.status === 'draft'
  const meta_dates: PrintableDocument['meta_dates'] = [
    { label: 'Emisión', value: formatDateArg(note.created_at) },
    { label: 'Fecha emisión', value: formatDateArg(note.issue_date) },
  ]
  if (note.invoice?.invoice_number) {
    meta_dates.push({ label: 'Factura asociada', value: note.invoice.invoice_number })
  }
  if (note.reason) {
    meta_dates.push({ label: 'Motivo', value: note.reason })
  }
  return {
    domain: 'sales',
    kind: 'sales_debit_note',
    isDraft,
    issuer,
    template,
    title: 'Nota de débito',
    document_number: note.debit_note_number,
    status_code: note.status,
    status_label: DEBIT_NOTE_STATUS_LABEL[note.status] ?? note.status,
    currency: note.currency,
    payment_condition: null,
    payment_condition_label: null,
    counterparty_role: 'customer',
    counterparty: counterpartyFromContact(note.contact),
    branch: branchFromModel(note.branch),
    meta_dates,
    lines: [],
    totals: totalsFrom(note.subtotal, note.discount_amount, note.tax_amount, note.total),
    notes: note.notes ?? null,
    payments: null,
    afip,
  }
}
