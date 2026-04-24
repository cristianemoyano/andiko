import 'server-only'
import Decimal from 'decimal.js'
import type { PaymentCondition } from '@/types'
import type { PrintableBranch, PrintableCounterparty, PrintableDocument, PrintableLineItem, PrintablePaymentRow, PrintableTotals } from '@/types/printing'
import type { TenantContext } from '@/lib/tenancy'
import { getPurchaseOrder } from '@/modules/purchases/purchase-orders.service'
import { getPurchaseReceipt } from '@/modules/purchases/purchase-receipts.service'
import { getSupplierInvoice } from '@/modules/purchases/supplier-invoices.service'
import { getSupplierPayment } from '@/modules/purchases/supplier-payments.service'
import { decString, formatDateArg } from './format-utils'
import { getIssuerName } from './issuer'
import { assertPrintAccess } from './tenant-guards'
import {
  PAYMENT_CONDITION_LABEL,
  PURCHASE_ORDER_STATUS_LABEL,
  PURCHASE_RECEIPT_STATUS_LABEL,
  SUPPLIER_INVOICE_STATUS_LABEL,
  labelPurchasePaymentMethod,
} from './labels'

type BranchInc = { id: string; name: string; branch_code: number }
type ContactInc = { legal_name: string; trade_name: string | null }

type PurchaseOrderLoaded = {
  org_id: string | null
  branch_id: string | null
  status: string
  order_number: string
  payment_condition: PaymentCondition
  currency: string
  notes: string | null
  created_at: Date
  expected_date: Date | null
  subtotal: unknown
  discount_amount: unknown
  tax_amount: unknown
  total: unknown
  branch?: BranchInc | null
  contact?: ContactInc | null
  items?: Parameters<typeof linesFromPurchaseOrderItems>[0]
}

type PurchaseReceiptLoaded = {
  org_id: string | null
  branch_id: string | null
  status: string
  receipt_number: string
  notes: string | null
  created_at: Date
  receipt_date: Date | null
  branch?: BranchInc | null
  contact?: ContactInc | null
  items?: Array<{ description: string; quantity: unknown; unit_cost: unknown }>
}

type SupplierInvoiceLoaded = {
  org_id: string | null
  branch_id: string | null
  status: string
  invoice_number: string
  payment_condition: PaymentCondition
  currency: string
  notes: string | null
  created_at: Date
  invoice_date: Date | null
  due_date: Date | null
  subtotal: unknown
  discount_amount: unknown
  tax_amount: unknown
  total: unknown
  branch?: BranchInc | null
  contact?: ContactInc | null
  items?: Parameters<typeof linesFromSupplierInvoiceItems>[0]
  payments?: Array<{
    payment_number: string
    payment_date: Date
    amount: string
    payment_method: string
    reference: string | null
  }>
}

type SupplierPaymentLoaded = {
  org_id: string | null
  branch_id: string | null
  payment_number: string
  payment_date: Date
  amount: unknown
  payment_method: string
  notes: string | null
  branch?: BranchInc | null
  contact?: ContactInc | null
  invoice?: { invoice_number: string; total: string; balance: string } | null
}

function branchFromModel(b: { id: string; name: string; branch_code: number } | null | undefined): PrintableBranch | null {
  if (!b) return null
  return { id: b.id, name: b.name, branch_code: b.branch_code }
}

function counterpartyFromContact(c: { legal_name: string; trade_name: string | null } | null | undefined): PrintableCounterparty | null {
  if (!c) return null
  return { legal_name: c.legal_name, trade_name: c.trade_name ?? null }
}

function linesFromPurchaseOrderItems(items: Array<{
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

function linesFromSupplierInvoiceItems(items: Array<{
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
  return linesFromPurchaseOrderItems(items as never)
}

function linesFromReceiptItems(items: Array<{
  description: string
  quantity: unknown
  unit_cost: unknown
}> | undefined): PrintableLineItem[] {
  if (!items?.length) return []
  return items.map(i => ({
    description: i.description,
    quantity: decString(i.quantity),
    unit_price: decString(i.unit_cost),
    discount_pct: null,
    iva_rate: null,
    subtotal: null,
    discount_amount: null,
    tax_amount: null,
    total: null,
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

export async function buildPurchaseOrderPrintable(id: string, ctx: TenantContext): Promise<PrintableDocument> {
  const order = (await getPurchaseOrder(id)) as unknown as PurchaseOrderLoaded
  assertPrintAccess({ org_id: order.org_id, branch_id: order.branch_id }, ctx)
  const issuerName = await getIssuerName(ctx.orgId)
  const pc = order.payment_condition as PaymentCondition
  const isDraft = order.status === 'draft'
  return {
    domain: 'purchases',
    kind: 'purchase_order',
    isDraft,
    issuer: { name: issuerName },
    title: 'Orden de compra',
    document_number: order.order_number,
    status_code: order.status,
    status_label: PURCHASE_ORDER_STATUS_LABEL[order.status] ?? order.status,
    currency: order.currency,
    payment_condition: pc,
    payment_condition_label: PAYMENT_CONDITION_LABEL[pc] ?? null,
    counterparty_role: 'supplier',
    counterparty: counterpartyFromContact(order.contact),
    branch: branchFromModel(order.branch),
    meta_dates: [
      { label: 'Emisión', value: formatDateArg(order.created_at) },
      { label: 'Esperada', value: formatDateArg(order.expected_date) },
    ],
    lines: linesFromPurchaseOrderItems(order.items),
    totals: totalsFrom(order.subtotal, order.discount_amount, order.tax_amount, order.total),
    notes: order.notes ?? null,
    payments: null,
  }
}

export async function buildPurchaseReceiptPrintable(id: string, ctx: TenantContext): Promise<PrintableDocument> {
  const receipt = (await getPurchaseReceipt(id)) as unknown as PurchaseReceiptLoaded
  assertPrintAccess({ org_id: receipt.org_id, branch_id: receipt.branch_id }, ctx)
  const issuerName = await getIssuerName(ctx.orgId)
  const isDraft = receipt.status === 'draft'
  return {
    domain: 'purchases',
    kind: 'purchase_receipt',
    isDraft,
    issuer: { name: issuerName },
    title: 'Recepción',
    document_number: receipt.receipt_number,
    status_code: receipt.status,
    status_label: PURCHASE_RECEIPT_STATUS_LABEL[receipt.status] ?? receipt.status,
    currency: 'ARS',
    payment_condition: null,
    payment_condition_label: null,
    counterparty_role: 'supplier',
    counterparty: counterpartyFromContact(receipt.contact),
    branch: branchFromModel(receipt.branch),
    meta_dates: [
      { label: 'Emisión', value: formatDateArg(receipt.created_at) },
      { label: 'Recepción', value: formatDateArg(receipt.receipt_date) },
    ],
    lines: linesFromReceiptItems(receipt.items),
    totals: (() => {
      const items = receipt.items
      let sum = new Decimal(0)
      for (const i of items ?? []) {
        sum = sum.plus(new Decimal(decString(i.quantity)).mul(new Decimal(decString(i.unit_cost))))
      }
      const t = sum.toFixed(2)
      return totalsFrom(t, null, '0.00', t)
    })(),
    notes: receipt.notes ?? null,
    payments: null,
  }
}

export async function buildSupplierInvoicePrintable(id: string, ctx: TenantContext): Promise<PrintableDocument> {
  const invoice = (await getSupplierInvoice(id)) as unknown as SupplierInvoiceLoaded
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
      payment_method: labelPurchasePaymentMethod(p.payment_method),
      reference: p.reference,
    }))
  })()
  return {
    domain: 'purchases',
    kind: 'supplier_invoice',
    isDraft,
    issuer: { name: issuerName },
    title: 'Factura proveedor',
    document_number: invoice.invoice_number,
    status_code: invoice.status,
    status_label: SUPPLIER_INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status,
    currency: invoice.currency,
    payment_condition: pc,
    payment_condition_label: PAYMENT_CONDITION_LABEL[pc] ?? null,
    counterparty_role: 'supplier',
    counterparty: counterpartyFromContact(invoice.contact),
    branch: branchFromModel(invoice.branch),
    meta_dates: [
      { label: 'Emisión', value: formatDateArg(invoice.created_at) },
      { label: 'Factura', value: formatDateArg(invoice.invoice_date) },
      { label: 'Vencimiento', value: formatDateArg(invoice.due_date) },
    ],
    lines: linesFromSupplierInvoiceItems(invoice.items),
    totals: totalsFrom(invoice.subtotal, invoice.discount_amount, invoice.tax_amount, invoice.total),
    notes: invoice.notes ?? null,
    payments,
  }
}

export async function buildSupplierPaymentPrintable(id: string, ctx: TenantContext): Promise<PrintableDocument> {
  const payment = (await getSupplierPayment(id, ctx.orgId)) as unknown as SupplierPaymentLoaded
  assertPrintAccess({ org_id: payment.org_id, branch_id: payment.branch_id }, ctx)
  const issuerName = await getIssuerName(ctx.orgId)
  const inv = payment.invoice
  return {
    domain: 'purchases',
    kind: 'supplier_payment',
    isDraft: false,
    issuer: { name: issuerName },
    title: 'Pago a proveedor',
    document_number: payment.payment_number,
    status_code: 'posted',
    status_label: 'Registrado',
    currency: 'ARS',
    payment_condition: null,
    payment_condition_label: null,
    counterparty_role: 'supplier',
    counterparty: counterpartyFromContact(payment.contact),
    branch: branchFromModel(payment.branch),
    meta_dates: [
      { label: 'Pago', value: formatDateArg(payment.payment_date) },
      { label: 'Factura asociada', value: inv?.invoice_number ?? null },
    ],
    lines: [],
    totals: totalsFrom(decString(payment.amount), null, '0', decString(payment.amount)),
    notes: payment.notes ?? null,
    payments: null,
  }
}
