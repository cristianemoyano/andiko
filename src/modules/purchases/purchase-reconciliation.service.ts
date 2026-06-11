import 'server-only'
import { Op } from 'sequelize'
import Decimal from 'decimal.js'
import { paginate, toPaginated } from '@/lib/pagination'
import { whereAllowedBranches, type TenantContext } from '@/lib/tenancy'
import PurchaseOrder from './purchase-order.model'
import PurchaseOrderItem from './purchase-order-item.model'
import PurchaseReceipt from './purchase-receipt.model'
import PurchaseReceiptItem from './purchase-receipt-item.model'
import SupplierInvoice from './supplier-invoice.model'
import SupplierInvoiceItem from './supplier-invoice-item.model'
import { ensurePurchasesBranchAssociations } from './purchases-branch-associations'
import type { ReconciliationQuery } from './purchase-reconciliation.schema'

/** Tolerance for every quantity/price comparison (Decimal, absolute). */
export const RECONCILIATION_TOLERANCE = '0.01'

/** POs eligible for reconciliation: beyond draft, excluding cancelled. */
const RECONCILABLE_ORDER_STATUSES = ['sent', 'partially_received', 'received'] as const

/** Receipt items only count when the receipt is confirmed. */
const COUNTED_RECEIPT_STATUSES = ['confirmed'] as const

/** Supplier invoices in these statuses are ignored. */
const EXCLUDED_INVOICE_STATUSES = ['draft', 'cancelled'] as const

/** Bound on how many orders a single reconciliation listing scans. */
const MAX_ORDERS = 500

// ---------------------------------------------------------------------------
// Pure comparison logic (unit-tested; no DB access)
// ---------------------------------------------------------------------------

export type OrderedLineInput = {
  id: string
  product_id: string | null
  variant_id: string | null
  description: string
  quantity: string
  unit_price: string
}

export type ReceivedLineInput = {
  order_item_id: string | null
  product_id: string | null
  variant_id: string | null
  description: string
  quantity: string
}

export type InvoicedLineInput = {
  product_id: string | null
  variant_id: string | null
  description: string
  quantity: string
  unit_price: string
}

export type ReconciliationItemLine = {
  key: string
  description: string
  product_id: string | null
  variant_id: string | null
  ordered_qty: string
  ordered_unit_price: string | null
  received_qty: string
  invoiced_qty: string
  /** Quantity-weighted average of matched invoice lines; null when not invoiced. */
  invoiced_unit_price: string | null
  qty_mismatch: boolean
  price_mismatch: boolean
  /** Line received or invoiced without a matching PO line. */
  is_extra: boolean
}

export type ReconciliationSummary = {
  ordered_qty: string
  received_qty: string
  invoiced_qty: string
  ordered_total: string
  invoiced_total: string
  qty_mismatch: boolean
  price_mismatch: boolean
  has_differences: boolean
}

export type OrderReconciliation = {
  items: ReconciliationItemLine[]
  summary: ReconciliationSummary
}

function dec(value: unknown): Decimal {
  return new Decimal(String(value ?? '0'))
}

function differs(a: Decimal, b: Decimal): boolean {
  return a.minus(b).abs().gt(RECONCILIATION_TOLERANCE)
}

/**
 * Matching key for a line. Supplier invoice items carry no `order_item_id`,
 * so invoice lines match PO lines by product + variant; lines without a
 * product fall back to a normalized description match.
 */
function lineKey(line: { product_id: string | null; variant_id: string | null; description: string }): string {
  if (line.product_id) return `p:${line.product_id}:${line.variant_id ?? ''}`
  return `d:${line.description.trim().toLowerCase()}`
}

/**
 * Compares ordered vs received vs invoiced lines for one purchase order.
 * All math/comparisons use Decimal.js with a 0.01 absolute tolerance.
 *
 * - Received lines match their PO line via `order_item_id` when present,
 *   otherwise by product/variant (description fallback).
 * - Invoiced lines always match by product/variant (description fallback).
 * - `qty_mismatch`: received ≠ ordered OR invoiced ≠ received.
 * - `price_mismatch`: any matched invoice line's unit price differs from the
 *   PO unit price beyond the tolerance.
 */
export function reconcileOrderLines(
  ordered: OrderedLineInput[],
  received: ReceivedLineInput[],
  invoiced: InvoicedLineInput[],
): OrderReconciliation {
  type Bucket = {
    key: string
    description: string
    product_id: string | null
    variant_id: string | null
    orderedQty: Decimal
    orderedUnitPrice: Decimal | null
    receivedQty: Decimal
    invoicedQty: Decimal
    invoicedAmount: Decimal
    priceMismatch: boolean
    isExtra: boolean
  }

  const buckets = new Map<string, Bucket>()
  const orderItemIdToKey = new Map<string, string>()

  const ensureBucket = (
    key: string,
    line: { description: string; product_id: string | null; variant_id: string | null },
    isExtra: boolean,
  ): Bucket => {
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = {
        key,
        description: line.description,
        product_id: line.product_id,
        variant_id: line.variant_id,
        orderedQty: new Decimal(0),
        orderedUnitPrice: null,
        receivedQty: new Decimal(0),
        invoicedQty: new Decimal(0),
        invoicedAmount: new Decimal(0),
        priceMismatch: false,
        isExtra,
      }
      buckets.set(key, bucket)
    }
    return bucket
  }

  for (const line of ordered) {
    const key = lineKey(line)
    orderItemIdToKey.set(line.id, key)
    const bucket = ensureBucket(key, line, false)
    bucket.isExtra = false
    bucket.orderedQty = bucket.orderedQty.plus(dec(line.quantity))
    // Same product on multiple PO lines: keep the first unit price as reference.
    if (bucket.orderedUnitPrice === null) bucket.orderedUnitPrice = dec(line.unit_price)
  }

  for (const line of received) {
    const key = (line.order_item_id ? orderItemIdToKey.get(line.order_item_id) : undefined) ?? lineKey(line)
    const bucket = ensureBucket(key, line, !buckets.has(key))
    bucket.receivedQty = bucket.receivedQty.plus(dec(line.quantity))
  }

  for (const line of invoiced) {
    const key = lineKey(line)
    const bucket = ensureBucket(key, line, !buckets.has(key))
    const qty = dec(line.quantity)
    const unitPrice = dec(line.unit_price)
    bucket.invoicedQty = bucket.invoicedQty.plus(qty)
    bucket.invoicedAmount = bucket.invoicedAmount.plus(qty.times(unitPrice))
    if (bucket.orderedUnitPrice !== null && differs(unitPrice, bucket.orderedUnitPrice)) {
      bucket.priceMismatch = true
    }
  }

  let orderedQtyTotal = new Decimal(0)
  let receivedQtyTotal = new Decimal(0)
  let invoicedQtyTotal = new Decimal(0)
  let orderedTotal = new Decimal(0)
  let invoicedTotal = new Decimal(0)
  let anyQtyMismatch = false
  let anyPriceMismatch = false

  const items: ReconciliationItemLine[] = [...buckets.values()].map((bucket) => {
    const qtyMismatch =
      differs(bucket.receivedQty, bucket.orderedQty) ||
      differs(bucket.invoicedQty, bucket.receivedQty)

    orderedQtyTotal = orderedQtyTotal.plus(bucket.orderedQty)
    receivedQtyTotal = receivedQtyTotal.plus(bucket.receivedQty)
    invoicedQtyTotal = invoicedQtyTotal.plus(bucket.invoicedQty)
    if (bucket.orderedUnitPrice !== null) {
      orderedTotal = orderedTotal.plus(bucket.orderedQty.times(bucket.orderedUnitPrice))
    }
    invoicedTotal = invoicedTotal.plus(bucket.invoicedAmount)
    anyQtyMismatch = anyQtyMismatch || qtyMismatch
    anyPriceMismatch = anyPriceMismatch || bucket.priceMismatch

    return {
      key: bucket.key,
      description: bucket.description,
      product_id: bucket.product_id,
      variant_id: bucket.variant_id,
      ordered_qty: bucket.orderedQty.toFixed(2),
      ordered_unit_price: bucket.orderedUnitPrice ? bucket.orderedUnitPrice.toFixed(2) : null,
      received_qty: bucket.receivedQty.toFixed(2),
      invoiced_qty: bucket.invoicedQty.toFixed(2),
      invoiced_unit_price: bucket.invoicedQty.gt(0)
        ? bucket.invoicedAmount.div(bucket.invoicedQty).toFixed(2)
        : null,
      qty_mismatch: qtyMismatch,
      price_mismatch: bucket.priceMismatch,
      is_extra: bucket.isExtra,
    }
  })

  return {
    items,
    summary: {
      ordered_qty: orderedQtyTotal.toFixed(2),
      received_qty: receivedQtyTotal.toFixed(2),
      invoiced_qty: invoicedQtyTotal.toFixed(2),
      ordered_total: orderedTotal.toFixed(2),
      invoiced_total: invoicedTotal.toFixed(2),
      qty_mismatch: anyQtyMismatch,
      price_mismatch: anyPriceMismatch,
      has_differences: anyQtyMismatch || anyPriceMismatch,
    },
  }
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

type ContactRef = { id: string; legal_name: string; trade_name: string | null } | null

type LoadedOrderDocs = {
  orderItems: Map<string, OrderedLineInput[]>
  receivedLines: Map<string, ReceivedLineInput[]>
  invoicedLines: Map<string, InvoicedLineInput[]>
  receiptRefs: Map<string, Array<{ id: string; receipt_number: string; status: string; receipt_date: string | null }>>
  invoiceRefs: Map<string, Array<{ id: string; invoice_number: string; supplier_invoice_number: string | null; status: string; total: string }>>
}

/**
 * Loads PO items, confirmed receipt items, and non-draft/cancelled supplier
 * invoice items for a set of order ids, keyed by order id.
 *
 * Supplier invoices attach to an order either directly (`order_id`) or
 * indirectly through their receipt (`receipt_id` → receipt.order_id).
 */
async function loadOrderDocs(orderIds: string[], orgId: string): Promise<LoadedOrderDocs> {
  const orderItems = new Map<string, OrderedLineInput[]>()
  const receivedLines = new Map<string, ReceivedLineInput[]>()
  const invoicedLines = new Map<string, InvoicedLineInput[]>()
  const receiptRefs: LoadedOrderDocs['receiptRefs'] = new Map()
  const invoiceRefs: LoadedOrderDocs['invoiceRefs'] = new Map()

  const push = <T>(map: Map<string, T[]>, key: string, value: T) => {
    const list = map.get(key)
    if (list) list.push(value)
    else map.set(key, [value])
  }

  const poItems = await PurchaseOrderItem.findAll({
    where: { org_id: orgId, order_id: { [Op.in]: orderIds } },
    attributes: ['id', 'order_id', 'product_id', 'variant_id', 'description', 'quantity', 'unit_price', 'sort_order'],
    order: [['sort_order', 'ASC']],
  })
  for (const item of poItems) {
    push(orderItems, String(item.order_id), {
      id: String(item.id),
      product_id: item.product_id ? String(item.product_id) : null,
      variant_id: item.variant_id ? String(item.variant_id) : null,
      description: String(item.description),
      quantity: String(item.quantity),
      unit_price: String(item.unit_price),
    })
  }

  const receipts = await PurchaseReceipt.findAll({
    where: {
      org_id: orgId,
      order_id: { [Op.in]: orderIds },
      status: { [Op.in]: [...COUNTED_RECEIPT_STATUSES] },
    },
    attributes: ['id', 'order_id', 'receipt_number', 'status', 'receipt_date'],
    include: [{
      model: PurchaseReceiptItem,
      as: 'items',
      attributes: ['id', 'order_item_id', 'product_id', 'variant_id', 'description', 'quantity'],
      required: false,
    }],
  })

  const receiptIdToOrderId = new Map<string, string>()
  for (const receipt of receipts) {
    const orderId = String(receipt.order_id)
    receiptIdToOrderId.set(String(receipt.id), orderId)
    push(receiptRefs, orderId, {
      id: String(receipt.id),
      receipt_number: String(receipt.receipt_number),
      status: String(receipt.status),
      receipt_date: receipt.receipt_date ? new Date(receipt.receipt_date).toISOString() : null,
    })
    const items = (receipt as PurchaseReceipt & { items?: PurchaseReceiptItem[] }).items ?? []
    for (const item of items) {
      push(receivedLines, orderId, {
        order_item_id: item.order_item_id ? String(item.order_item_id) : null,
        product_id: item.product_id ? String(item.product_id) : null,
        variant_id: item.variant_id ? String(item.variant_id) : null,
        description: String(item.description),
        quantity: String(item.quantity),
      })
    }
  }

  const receiptIds = [...receiptIdToOrderId.keys()]
  const invoices = await SupplierInvoice.findAll({
    where: {
      org_id: orgId,
      status: { [Op.notIn]: [...EXCLUDED_INVOICE_STATUSES] },
      [Op.or]: [
        { order_id: { [Op.in]: orderIds } },
        ...(receiptIds.length > 0 ? [{ receipt_id: { [Op.in]: receiptIds } }] : []),
      ],
    },
    attributes: ['id', 'order_id', 'receipt_id', 'invoice_number', 'supplier_invoice_number', 'status', 'total'],
    include: [{
      model: SupplierInvoiceItem,
      as: 'items',
      attributes: ['id', 'product_id', 'variant_id', 'description', 'quantity', 'unit_price'],
      required: false,
    }],
  })

  for (const invoice of invoices) {
    const orderId = invoice.order_id
      ? String(invoice.order_id)
      : (invoice.receipt_id ? receiptIdToOrderId.get(String(invoice.receipt_id)) : undefined)
    if (!orderId) continue
    push(invoiceRefs, orderId, {
      id: String(invoice.id),
      invoice_number: String(invoice.invoice_number),
      supplier_invoice_number: invoice.supplier_invoice_number ? String(invoice.supplier_invoice_number) : null,
      status: String(invoice.status),
      total: String(invoice.total),
    })
    const items = (invoice as SupplierInvoice & { items?: SupplierInvoiceItem[] }).items ?? []
    for (const item of items) {
      push(invoicedLines, orderId, {
        product_id: item.product_id ? String(item.product_id) : null,
        variant_id: item.variant_id ? String(item.variant_id) : null,
        description: String(item.description),
        quantity: String(item.quantity),
        unit_price: String(item.unit_price),
      })
    }
  }

  return { orderItems, receivedLines, invoicedLines, receiptRefs, invoiceRefs }
}

function contactRef(order: PurchaseOrder): ContactRef {
  const contact = (order as PurchaseOrder & {
    contact?: { id: string; legal_name: string; trade_name: string | null } | null
  }).contact
  if (!contact) return null
  return {
    id: String(contact.id),
    legal_name: String(contact.legal_name),
    trade_name: contact.trade_name ? String(contact.trade_name) : null,
  }
}

// ---------------------------------------------------------------------------
// Public services
// ---------------------------------------------------------------------------

export type ReconciliationListRow = {
  id: string
  order_number: string
  status: string
  created_at: string
  expected_date: string | null
  contact: ContactRef
  ordered_qty: string
  received_qty: string
  invoiced_qty: string
  ordered_total: string
  invoiced_total: string
  receipt_count: number
  invoice_count: number
  qty_mismatch: boolean
  price_mismatch: boolean
  has_differences: boolean
}

/**
 * Paginated reconciliation listing over purchase orders beyond draft
 * (sent / partially_received / received). Rollups and flags are computed
 * in application code with Decimal.js over the latest {@link MAX_ORDERS}
 * orders; filtering (search, only differences) and pagination happen
 * in-memory, mirroring the account-statement service pattern.
 */
export async function listReconciliation(query: ReconciliationQuery, ctx: TenantContext) {
  ensurePurchasesBranchAssociations()
  const { default: Contact } = await import('@/modules/contacts/contact.model')

  const orders = await PurchaseOrder.findAll({
    where: whereAllowedBranches(ctx, { status: { [Op.in]: [...RECONCILABLE_ORDER_STATUSES] } }),
    attributes: ['id', 'order_number', 'status', 'contact_id', 'branch_id', 'expected_date', 'total', 'created_at'],
    include: [{ model: Contact, as: 'contact', attributes: ['id', 'legal_name', 'trade_name'], required: false }],
    order: [['created_at', 'DESC']],
    limit: MAX_ORDERS,
  })

  if (orders.length === 0) {
    return toPaginated<ReconciliationListRow>([], 0, query.page, query.limit)
  }

  const orderIds = orders.map(o => String(o.id))
  const docs = await loadOrderDocs(orderIds, ctx.orgId)

  const allRows: ReconciliationListRow[] = orders.map((order) => {
    const orderId = String(order.id)
    const { summary } = reconcileOrderLines(
      docs.orderItems.get(orderId) ?? [],
      docs.receivedLines.get(orderId) ?? [],
      docs.invoicedLines.get(orderId) ?? [],
    )
    return {
      id: orderId,
      order_number: String(order.order_number),
      status: String(order.status),
      created_at: new Date(order.created_at).toISOString(),
      expected_date: order.expected_date ? new Date(order.expected_date).toISOString() : null,
      contact: contactRef(order),
      ordered_qty: summary.ordered_qty,
      received_qty: summary.received_qty,
      invoiced_qty: summary.invoiced_qty,
      ordered_total: summary.ordered_total,
      invoiced_total: summary.invoiced_total,
      receipt_count: docs.receiptRefs.get(orderId)?.length ?? 0,
      invoice_count: docs.invoiceRefs.get(orderId)?.length ?? 0,
      qty_mismatch: summary.qty_mismatch,
      price_mismatch: summary.price_mismatch,
      has_differences: summary.has_differences,
    }
  })

  const search = query.search?.trim().toLowerCase() ?? ''
  const filtered = allRows.filter((row) => {
    if (query.only_differences && !row.has_differences) return false
    if (!search) return true
    const haystack = [
      row.order_number,
      row.contact?.legal_name ?? '',
      row.contact?.trade_name ?? '',
    ].join(' ').toLowerCase()
    return haystack.includes(search)
  })

  const { offset } = paginate(query.page, query.limit)
  const paged = filtered.slice(offset, offset + query.limit)
  return toPaginated(paged, filtered.length, query.page, query.limit)
}

export type ReconciliationDetail = {
  order: {
    id: string
    order_number: string
    status: string
    created_at: string
    expected_date: string | null
    total: string
    contact: ContactRef
  }
  items: ReconciliationItemLine[]
  summary: ReconciliationSummary
  receipts: Array<{ id: string; receipt_number: string; status: string; receipt_date: string | null }>
  invoices: Array<{ id: string; invoice_number: string; supplier_invoice_number: string | null; status: string; total: string }>
}

/**
 * Per-item reconciliation breakdown for one purchase order:
 * ordered qty/price vs received qty vs invoiced qty/price with
 * per-item difference flags.
 */
export async function getReconciliationDetail(orderId: string, ctx: TenantContext): Promise<ReconciliationDetail> {
  ensurePurchasesBranchAssociations()
  const { default: Contact } = await import('@/modules/contacts/contact.model')

  const order = await PurchaseOrder.findOne({
    where: whereAllowedBranches(ctx, { id: orderId }),
    attributes: ['id', 'order_number', 'status', 'contact_id', 'branch_id', 'expected_date', 'total', 'created_at'],
    include: [{ model: Contact, as: 'contact', attributes: ['id', 'legal_name', 'trade_name'], required: false }],
  })
  if (!order) throw new Error('PURCHASE_ORDER_NOT_FOUND')

  const id = String(order.id)
  const docs = await loadOrderDocs([id], ctx.orgId)
  const { items, summary } = reconcileOrderLines(
    docs.orderItems.get(id) ?? [],
    docs.receivedLines.get(id) ?? [],
    docs.invoicedLines.get(id) ?? [],
  )

  return {
    order: {
      id,
      order_number: String(order.order_number),
      status: String(order.status),
      created_at: new Date(order.created_at).toISOString(),
      expected_date: order.expected_date ? new Date(order.expected_date).toISOString() : null,
      total: String(order.total),
      contact: contactRef(order),
    },
    items,
    summary,
    receipts: docs.receiptRefs.get(id) ?? [],
    invoices: docs.invoiceRefs.get(id) ?? [],
  }
}
