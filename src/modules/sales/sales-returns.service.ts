import 'server-only'
import Decimal from 'decimal.js'
import type { Transaction } from 'sequelize'
import { Op } from 'sequelize'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import { combineListWhere } from '@/modules/integrations/woocommerce/woo-list-filters'
import type { TenantContext } from '@/lib/tenancy'
import { whereSalesDocumentScope, whereSalesDocumentScopeViaOrder } from './sales-scope'
import SalesReturn from './sales-return.model'
import SalesReturnItem, { type SalesReturnItemAttributes } from './sales-return-item.model'
import SalesReturnExchangeItem, { type SalesReturnExchangeItemAttributes } from './sales-return-exchange-item.model'
import SalesOrder from './sales-order.model'
import SalesOrderItem from './sales-order-item.model'
import Invoice from './invoice.model'
import InvoiceItem from './invoice-item.model'
import CreditNote from './credit-note.model'
import CreditNoteItem from './credit-note-item.model'
import Branch from '@/modules/auth/branch.model'
import Product from '@/modules/catalog/product.model'
import ProductVariant from '@/modules/catalog/product-variant.model'
import { BRANCH_AFIP_ATTRIBUTES } from './sales-branch-associations'
import { nextDocumentNumber, calcLineItem, calcDocumentTotals } from './sales.utils'
import { issueCreditNoteInTransaction } from './credit-notes.service'
import DebitNote from './debit-note.model'
import { issueDebitNoteInTransaction } from './debit-notes.service'
import { createSalesRefund } from './sales-refunds.service'
import { postReturnAccounting } from '@/modules/accounting/sales-return-accounting.service'
import { resolveDefaultWarehouse } from '@/modules/inventory/warehouses.service'
import {
  restoreStockForReturn,
  deductStockForExchange,
  reverseStockForReturn,
} from '@/modules/inventory/stock-movements.service'
import type {
  CreateSalesReturnInput,
  UpdateSalesReturnInput,
  CompleteSalesReturnInput,
  SalesReturnQuery,
} from './sales-return.schema'
import type { IvaRate } from '@/types'
import type { OrderStatus } from './sales-order.model'

const RETURNABLE_ORDER_STATUSES: OrderStatus[] = ['delivered', 'partial_returned', 'returned']

function auditUserId(ctx: TenantContext): string | null {
  return ctx.userId || null
}

function stockActorId(ctx: TenantContext): string {
  return auditUserId(ctx) ?? ctx.orgId
}

export async function listSalesReturns(query: SalesReturnQuery, ctx: TenantContext) {
  ensureSalesReturnAssociations()
  const { offset, limit } = paginate(query.page, query.limit)
  const where = combineListWhere(
    whereSalesDocumentScopeViaOrder(ctx),
    query.status ? { status: query.status } : {},
    query.order_id ? { order_id: query.order_id } : {},
    query.operation_type ? { operation_type: query.operation_type } : {},
    query.search
      ? {
          [Op.or]: [
            { return_number: { [Op.iLike]: `%${query.search}%` } },
            { '$order.order_number$': { [Op.iLike]: `%${query.search}%` } },
          ],
        }
      : {},
  ) as Record<string, unknown>

  const { rows, count } = await SalesReturn.findAndCountAll({
    where,
    subQuery: query.search || ctx.salesScopeOwn ? false : undefined,
    attributes: [
      'id', 'return_number', 'operation_type', 'status', 'order_id', 'invoice_id',
      'credit_note_id', 'returned_total', 'exchange_total', 'difference_total',
      'completed_at', 'created_at',
    ],
    include: [
      { model: SalesOrder, as: 'order', attributes: ['id', 'order_number', 'status', 'salesperson_id', 'created_by'], required: false },
    ],
    order: [['created_at', 'DESC']],
    limit,
    offset,
  })

  return toPaginated(rows, count, query.page, query.limit)
}

export async function listReturnsByOrder(orderId: string, ctx: TenantContext) {
  ensureSalesReturnAssociations()
  return SalesReturn.findAll({
    where: whereSalesDocumentScopeViaOrder(ctx, { order_id: orderId }),
    attributes: [
      'id', 'return_number', 'operation_type', 'status', 'credit_note_id',
      'returned_total', 'exchange_total', 'difference_total', 'completed_at', 'created_at',
    ],
    include: [
      { model: CreditNote, as: 'creditNote', attributes: ['id', 'credit_note_number', 'cae', 'status'], required: false },
    ],
    order: [['created_at', 'ASC']],
  })
}

export async function getSalesReturn(id: string, ctx: TenantContext) {
  ensureSalesReturnAssociations()

  const row = await SalesReturn.findOne({
    where: whereSalesDocumentScopeViaOrder(ctx, { id }),
    include: [
      { model: Branch, as: 'branch', attributes: [...BRANCH_AFIP_ATTRIBUTES], required: false },
      { model: SalesOrder, as: 'order', attributes: ['id', 'order_number', 'status', 'contact_id'], required: false },
      { model: Invoice, as: 'invoice', attributes: ['id', 'invoice_number', 'status', 'total', 'balance'], required: false },
      { model: CreditNote, as: 'creditNote', attributes: ['id', 'credit_note_number', 'status', 'total', 'cae'], required: false },
      { model: SalesReturnItem, as: 'items', order: [['sort_order', 'ASC']] },
      { model: SalesReturnExchangeItem, as: 'exchangeItems', order: [['sort_order', 'ASC']] },
    ],
  })
  if (!row) throw new Error('SALES_RETURN_NOT_FOUND')
  return row
}

export async function createReturnFromOrder(input: CreateSalesReturnInput, ctx: TenantContext) {
  const { orgId } = ctx
  const actorId = auditUserId(ctx)
  if (!orgId) throw new Error('ORG_CONTEXT_REQUIRED')

  if (input.pos_local_id) {
    const existing = await SalesReturn.findOne({
      where: { org_id: orgId, pos_local_id: input.pos_local_id },
    })
    if (existing) return getSalesReturn(existing.id, ctx)
  }

  return sequelize.transaction(async (t) => {
    const order = await SalesOrder.findOne({
      where: whereSalesDocumentScope(ctx, { id: input.order_id }),
      transaction: t,
      lock: t.LOCK.UPDATE,
    })
    if (!order) throw new Error('ORDER_NOT_FOUND')
    if (!RETURNABLE_ORDER_STATUSES.includes(order.status)) {
      throw new Error('ORDER_NOT_RETURNABLE')
    }
    if (!order.branch_id) throw new Error('ORDER_BRANCH_REQUIRED')

    const invoice = await Invoice.findOne({
      where: {
        order_id: order.id,
        org_id: orgId,
        status: { [Op.notIn]: ['cancelled', 'draft'] },
      },
      transaction: t,
    })

    const warehouseId = input.warehouse_id
      ?? await resolveDefaultWarehouse(order.branch_id, orgId, t)
    if (!warehouseId) throw new Error('WAREHOUSE_REQUIRED')

    const return_number = await nextDocumentNumber(orgId, order.branch_id, 'sales_return', t)
    const { returnedTotals, exchangeTotals, differenceTotal, returnItems, exchangeItems } =
      await buildReturnLines(input, order.id, orgId, t)

    const salesReturn = await SalesReturn.create(
      {
        org_id:             orgId,
        branch_id:          order.branch_id,
        order_id:           order.id,
        invoice_id:         invoice?.id ?? null,
        warehouse_id:       warehouseId,
        return_number,
        operation_type:     input.operation_type,
        status:             'draft',
        source:             input.pos_local_id ? 'pos' : 'erp',
        pos_local_id:       input.pos_local_id ?? null,
        returned_subtotal:  returnedTotals.subtotal,
        returned_discount:  returnedTotals.discount_amount,
        returned_tax:       returnedTotals.tax_amount,
        returned_total:     returnedTotals.total,
        exchange_subtotal:  exchangeTotals.subtotal,
        exchange_discount:  exchangeTotals.discount_amount,
        exchange_tax:       exchangeTotals.tax_amount,
        exchange_total:     exchangeTotals.total,
        difference_total:   differenceTotal,
        reason:             input.reason ?? null,
        notes:              input.notes ?? null,
        created_by:         actorId,
        updated_by:         actorId,
      },
      { transaction: t },
    )

    await SalesReturnItem.bulkCreate(
      returnItems.map((item, idx) => ({
        ...item,
        return_id: salesReturn.id,
        org_id:    orgId,
        sort_order: idx,
        created_by: actorId,
        updated_by: actorId,
      })),
      { transaction: t },
    )

    if (exchangeItems.length > 0) {
      await SalesReturnExchangeItem.bulkCreate(
        exchangeItems.map((item, idx) => ({
          ...item,
          return_id: salesReturn.id,
          org_id:    orgId,
          sort_order: idx,
          created_by: actorId,
          updated_by: actorId,
        })),
        { transaction: t },
      )
    }

    logger.info({ returnId: salesReturn.id, return_number, orderId: order.id }, 'sales return created')
    return getSalesReturnInTransaction(salesReturn.id, ctx, t)
  })
}

export async function updateSalesReturn(id: string, input: UpdateSalesReturnInput, ctx: TenantContext) {
  return sequelize.transaction(async (t) => {
    const salesReturn = await SalesReturn.findOne({
      where: whereSalesDocumentScopeViaOrder(ctx, { id }),
      transaction: t,
      lock: t.LOCK.UPDATE,
    })
    if (!salesReturn) throw new Error('SALES_RETURN_NOT_FOUND')
    if (salesReturn.status !== 'draft') throw new Error('SALES_RETURN_NOT_EDITABLE')

    if (input.items) {
      const built = await buildReturnLines(
        {
          items:          input.items,
          exchange_items: input.exchange_items ?? [],
          operation_type: salesReturn.operation_type,
        },
        salesReturn.order_id,
        ctx.orgId!,
        t,
      )

      await SalesReturnItem.destroy({ where: { return_id: id }, transaction: t, force: false })
      await SalesReturnExchangeItem.destroy({ where: { return_id: id }, transaction: t, force: false })

      await SalesReturnItem.bulkCreate(
        built.returnItems.map((item, idx) => ({
          ...item,
          return_id: id,
          org_id:    ctx.orgId,
          sort_order: idx,
          created_by: auditUserId(ctx),
          updated_by: auditUserId(ctx),
        })),
        { transaction: t },
      )

      if (built.exchangeItems.length > 0) {
        await SalesReturnExchangeItem.bulkCreate(
          built.exchangeItems.map((item, idx) => ({
            ...item,
            return_id: id,
            org_id:    ctx.orgId,
            sort_order: idx,
            created_by: auditUserId(ctx),
            updated_by: auditUserId(ctx),
          })),
          { transaction: t },
        )
      }

      await salesReturn.update({
        returned_subtotal: built.returnedTotals.subtotal,
        returned_discount: built.returnedTotals.discount_amount,
        returned_tax:      built.returnedTotals.tax_amount,
        returned_total:    built.returnedTotals.total,
        exchange_subtotal: built.exchangeTotals.subtotal,
        exchange_discount: built.exchangeTotals.discount_amount,
        exchange_tax:      built.exchangeTotals.tax_amount,
        exchange_total:    built.exchangeTotals.total,
        difference_total:  built.differenceTotal,
        warehouse_id:      input.warehouse_id ?? salesReturn.warehouse_id,
        reason:              input.reason ?? salesReturn.reason,
        notes:               input.notes ?? salesReturn.notes,
        updated_by:          auditUserId(ctx),
      }, { transaction: t })
    } else {
      await salesReturn.update({
        warehouse_id: input.warehouse_id ?? salesReturn.warehouse_id,
        reason:       input.reason ?? salesReturn.reason,
        notes:        input.notes ?? salesReturn.notes,
        updated_by:   auditUserId(ctx),
      }, { transaction: t })
    }

    return getSalesReturnInTransaction(id, ctx, t)
  })
}

export async function confirmReturn(id: string, ctx: TenantContext) {
  return sequelize.transaction(async (t) => {
    const salesReturn = await loadReturnForMutation(id, ctx, t)
    if (salesReturn.status !== 'draft') throw new Error('SALES_RETURN_ALREADY_CONFIRMED')

    const actorId = stockActorId(ctx)
    await restoreStockForReturn(id, ctx.orgId!, actorId, t)
    if (salesReturn.operation_type === 'exchange') {
      await deductStockForExchange(id, ctx.orgId!, actorId, t)
    }

    await applyReturnedQty(salesReturn, t, auditUserId(ctx))

    await salesReturn.update(
      { status: 'confirmed', updated_by: auditUserId(ctx) },
      { transaction: t },
    )

    return getSalesReturnInTransaction(id, ctx, t)
  })
}

export async function completeReturn(id: string, input: CompleteSalesReturnInput, ctx: TenantContext) {
  return sequelize.transaction(async (t) => {
    const salesReturn = await loadReturnForMutation(id, ctx, t)
    if (salesReturn.status === 'completed') throw new Error('SALES_RETURN_ALREADY_COMPLETED')
    if (salesReturn.status === 'cancelled') throw new Error('SALES_RETURN_CANCELLED')

    if (salesReturn.status === 'draft') {
      const actorId = stockActorId(ctx)
      await restoreStockForReturn(id, ctx.orgId!, actorId, t)
      if (salesReturn.operation_type === 'exchange') {
        await deductStockForExchange(id, ctx.orgId!, actorId, t)
      }
      await applyReturnedQty(salesReturn, t, auditUserId(ctx))
      await salesReturn.update({ status: 'confirmed' }, { transaction: t })
    }

    let creditNoteId = salesReturn.credit_note_id

    if (salesReturn.invoice_id && !creditNoteId) {
      creditNoteId = await createCreditNoteFromReturn(salesReturn, ctx, t)
      await salesReturn.update({ credit_note_id: creditNoteId }, { transaction: t })
      await issueCreditNoteInTransaction(creditNoteId, ctx, t)
    }

    if (
      salesReturn.operation_type === 'exchange' &&
      salesReturn.invoice_id &&
      new Decimal(salesReturn.difference_total).gt(0)
    ) {
      await createExchangeDebitNoteFromReturn(salesReturn, ctx, t)
    }

    const disposition = input.refund_disposition ?? salesReturn.refund_disposition ?? 'account_credit'
    await salesReturn.update({
      refund_disposition: disposition,
      status:             'completed',
      completed_at:       new Date(),
      updated_by:         auditUserId(ctx),
    }, { transaction: t })

    if (disposition === 'cash_refund' && creditNoteId && input.refund_amount) {
      await createSalesRefund({
        return_id:      id,
        credit_note_id: creditNoteId,
        amount:         String(input.refund_amount),
        refund_method:  input.refund_method ?? 'cash',
        refund_date:    new Date(),
        reference:      input.refund_reference ?? null,
        notes:          input.refund_notes ?? null,
        payment_id:     input.payment_id ?? null,
      }, ctx, t)
    }

    await recalcOrderReturnStatus(salesReturn.order_id, t)
    await postReturnAccounting(id, ctx, t)

    logger.info({ returnId: id }, 'sales return completed')
    return getSalesReturnInTransaction(id, ctx, t)
  })
}

export async function cancelReturn(id: string, ctx: TenantContext) {
  return sequelize.transaction(async (t) => {
    const salesReturn = await loadReturnForMutation(id, ctx, t)
    if (salesReturn.status === 'cancelled') throw new Error('SALES_RETURN_ALREADY_CANCELLED')
    if (salesReturn.status === 'completed') throw new Error('SALES_RETURN_ALREADY_COMPLETED')

    if (salesReturn.status === 'confirmed') {
      await reverseReturnedQty(salesReturn, t, auditUserId(ctx))
      await reverseStockForReturn(id, ctx.orgId!, stockActorId(ctx), t)
    }

    await salesReturn.update(
      { status: 'cancelled', updated_by: auditUserId(ctx) },
      { transaction: t },
    )

    await recalcOrderReturnStatus(salesReturn.order_id, t)
    return getSalesReturnInTransaction(id, ctx, t)
  })
}

export async function recalcOrderReturnStatus(orderId: string, t: Transaction): Promise<void> {
  const order = await SalesOrder.findByPk(orderId, { transaction: t, lock: t.LOCK.UPDATE })
  if (!order) return
  if (order.status === 'cancelled' || order.status === 'draft') return
  if (!['delivered', 'partial_returned', 'returned'].includes(order.status)) return

  const items = await SalesOrderItem.findAll({
    where: { order_id: orderId },
    attributes: ['id', 'quantity', 'returned_qty', 'variant_id', 'product_id'],
    transaction: t,
  })

  let anyReturned = false
  let allPhysicalReturned = true
  let hasStockable = false

  for (const item of items) {
    const isStockable = await isOrderItemStockable(item, t)
    if (!isStockable) continue
    hasStockable = true

    const rq = new Decimal(item.returned_qty ?? '0')
    const q  = new Decimal(item.quantity)
    if (rq.gt(0)) anyReturned = true
    if (rq.lt(q)) allPhysicalReturned = false
  }

  let nextStatus: OrderStatus = 'delivered'
  if (hasStockable && anyReturned) {
    nextStatus = allPhysicalReturned ? 'returned' : 'partial_returned'
  }

  if (order.status !== nextStatus) {
    await order.update({ status: nextStatus }, { transaction: t })
  }
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/** Resolves an order line for a return — POS orders may lack product_id (description-only). */
function resolveOrderItemForReturn(
  line: CreateSalesReturnInput['items'][number],
  orderItems: SalesOrderItem[],
  orderItemMap: Map<string, SalesOrderItem>,
): SalesOrderItem | undefined {
  if (line.order_item_id) {
    const hit = orderItemMap.get(line.order_item_id)
    if (hit) return hit
  }

  if (line.product_id) {
    // POS local catalog id is the variant uuid
    const byVariant = orderItems.filter(oi => oi.variant_id === line.product_id)
    if (byVariant.length === 1) return byVariant[0]
    const byProduct = orderItems.filter(oi => oi.product_id === line.product_id)
    if (byProduct.length === 1) return byProduct[0]
    if (line.variant_id != null) {
      const hit = byProduct.find(oi => oi.variant_id === line.variant_id)
      if (hit) return hit
    }
  }

  if (line.variant_id) {
    const byVariant = orderItems.filter(oi => oi.variant_id === line.variant_id)
    if (byVariant.length === 1) return byVariant[0]
  }

  if (line.description) {
    const norm = line.description.trim().toLowerCase()
    const byDesc = orderItems.filter(oi => oi.description.trim().toLowerCase() === norm)
    if (byDesc.length === 1) return byDesc[0]
  }

  if (orderItems.length === 1) return orderItems[0]

  return undefined
}

async function buildReturnLines(
  input: {
    items: CreateSalesReturnInput['items']
    exchange_items?: CreateSalesReturnInput['exchange_items']
    operation_type?: CreateSalesReturnInput['operation_type']
  },
  orderId: string,
  orgId: string,
  t: Transaction,
) {
  const orderItems = await SalesOrderItem.findAll({
    where: { order_id: orderId },
    transaction: t,
  })
  const orderItemMap = new Map(orderItems.map(i => [String(i.id), i]))

  const invoice = await Invoice.findOne({
    where: { order_id: orderId, org_id: orgId, status: { [Op.notIn]: ['cancelled', 'draft'] } },
    transaction: t,
  })
  const invoiceItems = invoice
    ? await InvoiceItem.findAll({ where: { invoice_id: invoice.id }, transaction: t })
    : []
  const invoiceByOrderItem = new Map(
    invoiceItems.map(ii => {
      const match = orderItems.find(oi =>
        oi.product_id === ii.product_id &&
        oi.variant_id === ii.variant_id &&
        oi.description === ii.description,
      )
      return match ? [String(match.id), ii] as const : null
    }).filter((x): x is [string, InvoiceItem] => x !== null),
  )

  const returnLineTotals = []
  const returnItems: Array<Omit<SalesReturnItemAttributes, 'id' | 'return_id' | 'org_id' | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'>> = []

  for (const [idx, line] of input.items.entries()) {
    const orderItem = resolveOrderItemForReturn(line, orderItems, orderItemMap)
    if (!orderItem) throw new Error('ORDER_ITEM_NOT_FOUND')

    const alreadyReturned = new Decimal(orderItem.returned_qty ?? '0')
    const maxReturnable = new Decimal(orderItem.quantity).minus(alreadyReturned)
    const qty = new Decimal(line.quantity)
    if (qty.gt(maxReturnable)) throw new Error('RETURN_QUANTITY_EXCEEDS_AVAILABLE')

    const totals = calcLineItem(
      line.quantity,
      orderItem.unit_price,
      orderItem.discount_pct,
      orderItem.iva_rate as IvaRate,
    )
    returnLineTotals.push(totals)

    const invItem = invoiceByOrderItem.get(String(orderItem.id))
    returnItems.push({
      order_item_id:   orderItem.id,
      invoice_item_id: invItem?.id ?? null,
      product_id:      orderItem.product_id,
      variant_id:      orderItem.variant_id,
      description:     orderItem.description,
      quantity:        String(line.quantity),
      unit_price:      orderItem.unit_price,
      discount_pct:    orderItem.discount_pct,
      iva_rate:        orderItem.iva_rate,
      batch_code:      line.batch_code ?? null,
      expiry_date:     line.expiry_date ?? null,
      sort_order:      idx,
      ...totals,
    })
  }

  const returnedTotals = calcDocumentTotals(returnLineTotals)

  const exchangeLineTotals = []
  const exchangeItems: Array<Omit<SalesReturnExchangeItemAttributes, 'id' | 'return_id' | 'org_id' | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'>> = []

  for (const [idx, line] of (input.exchange_items ?? []).entries()) {
    const totals = calcLineItem(
      line.quantity,
      line.unit_price,
      line.discount_pct ?? 0,
      (line.iva_rate ?? '21') as IvaRate,
    )
    exchangeLineTotals.push(totals)
    exchangeItems.push({
      product_id:   line.product_id ?? null,
      variant_id:   line.variant_id ?? null,
      description:  line.description,
      quantity:     String(line.quantity),
      unit_price:   String(line.unit_price),
      discount_pct: String(line.discount_pct ?? 0),
      iva_rate:     line.iva_rate ?? '21',
      sort_order:   line.sort_order ?? idx,
      ...totals,
    })
  }

  const exchangeTotals = exchangeLineTotals.length > 0
    ? calcDocumentTotals(exchangeLineTotals)
    : { subtotal: '0.00', discount_amount: '0.00', tax_amount: '0.00', total: '0.00' }

  const differenceTotal = new Decimal(exchangeTotals.total).minus(returnedTotals.total).toFixed(2)

  return { returnedTotals, exchangeTotals, differenceTotal, returnItems, exchangeItems }
}

async function createCreditNoteFromReturn(
  salesReturn: SalesReturn,
  ctx: TenantContext,
  t: Transaction,
): Promise<string> {
  const order = await SalesOrder.findByPk(salesReturn.order_id, { transaction: t })
  const items = await SalesReturnItem.findAll({
    where: { return_id: salesReturn.id },
    transaction: t,
  })

  const credit_note_number = await nextDocumentNumber(
    ctx.orgId!,
    salesReturn.branch_id!,
    'credit_note',
    t,
  )

  const note = await CreditNote.create({
    org_id:             ctx.orgId,
    branch_id:          salesReturn.branch_id,
    contact_id:         order?.contact_id ?? null,
    invoice_id:         salesReturn.invoice_id,
    order_id:           salesReturn.order_id,
    return_id:          salesReturn.id,
    credit_note_number,
    status:             'draft',
    issue_date:         new Date(),
    currency:           'ARS',
    subtotal:           salesReturn.returned_subtotal,
    discount_amount:    salesReturn.returned_discount,
    tax_amount:         salesReturn.returned_tax,
    total:              salesReturn.returned_total,
    applied_amount:     '0',
    remaining:          salesReturn.returned_total,
    reason:             salesReturn.reason,
    notes:              salesReturn.notes,
    created_by:         auditUserId(ctx),
    updated_by:         auditUserId(ctx),
  }, { transaction: t })

  await CreditNoteItem.bulkCreate(
    items.map((item, idx) => ({
      credit_note_id:  note.id,
      org_id:          ctx.orgId,
      invoice_item_id: item.invoice_item_id,
      product_id:      item.product_id,
      variant_id:      item.variant_id,
      description:     item.description,
      quantity:        item.quantity,
      unit_price:      item.unit_price,
      discount_pct:    item.discount_pct,
      iva_rate:        item.iva_rate,
      subtotal:        item.subtotal,
      discount_amount: item.discount_amount,
      tax_base:        item.tax_base,
      tax_amount:      item.tax_amount,
      total:           item.total,
      sort_order:      idx,
      created_by:      auditUserId(ctx),
      updated_by:      auditUserId(ctx),
    })),
    { transaction: t },
  )

  return note.id
}

async function createExchangeDebitNoteFromReturn(
  salesReturn: SalesReturn,
  ctx: TenantContext,
  t: Transaction,
): Promise<string> {
  const order = await SalesOrder.findByPk(salesReturn.order_id, { transaction: t })
  const diffSubtotal = new Decimal(salesReturn.exchange_subtotal).minus(salesReturn.returned_subtotal).toFixed(2)
  const diffDiscount = new Decimal(salesReturn.exchange_discount).minus(salesReturn.returned_discount).toFixed(2)
  const diffTax = new Decimal(salesReturn.exchange_tax).minus(salesReturn.returned_tax).toFixed(2)

  const debit_note_number = await nextDocumentNumber(
    ctx.orgId!,
    salesReturn.branch_id!,
    'debit_note',
    t,
  )

  const note = await DebitNote.create({
    org_id:             ctx.orgId,
    branch_id:          salesReturn.branch_id,
    contact_id:         order?.contact_id ?? null,
    invoice_id:         salesReturn.invoice_id,
    debit_note_number,
    status:             'draft',
    issue_date:         new Date(),
    currency:           'ARS',
    subtotal:           diffSubtotal,
    discount_amount:    diffDiscount,
    tax_amount:         diffTax,
    total:              salesReturn.difference_total,
    reason:             salesReturn.reason ?? 'Diferencia por cambio de mercadería',
    notes:              `Devolución ${salesReturn.return_number}`,
    created_by:         auditUserId(ctx),
    updated_by:         auditUserId(ctx),
  }, { transaction: t })

  await issueDebitNoteInTransaction(note.id, ctx, t)
  return note.id
}

async function applyReturnedQty(salesReturn: SalesReturn, t: Transaction, actorId: string | null) {
  const items = await SalesReturnItem.findAll({
    where: { return_id: salesReturn.id },
    transaction: t,
  })

  for (const item of items) {
    const orderItem = await SalesOrderItem.findByPk(item.order_item_id, { transaction: t, lock: t.LOCK.UPDATE })
    if (!orderItem) continue
    const next = new Decimal(orderItem.returned_qty ?? '0').plus(item.quantity)
    await orderItem.update({ returned_qty: next.toFixed(4), updated_by: actorId }, { transaction: t })
  }
}

async function reverseReturnedQty(salesReturn: SalesReturn, t: Transaction, actorId: string | null) {
  const items = await SalesReturnItem.findAll({
    where: { return_id: salesReturn.id },
    transaction: t,
  })

  for (const item of items) {
    const orderItem = await SalesOrderItem.findByPk(item.order_item_id, { transaction: t, lock: t.LOCK.UPDATE })
    if (!orderItem) continue
    const next = Decimal.max(new Decimal(orderItem.returned_qty ?? '0').minus(item.quantity), new Decimal(0))
    await orderItem.update({ returned_qty: next.toFixed(4), updated_by: actorId }, { transaction: t })
  }
}

async function isOrderItemStockable(
  item: Pick<SalesOrderItem, 'variant_id' | 'product_id'>,
  t: Transaction,
): Promise<boolean> {
  if (item.variant_id) {
    const v = await ProductVariant.findByPk(item.variant_id, { attributes: ['manage_stock'], transaction: t })
    if (v && !v.manage_stock) return false
  }
  if (item.product_id) {
    const p = await Product.findByPk(item.product_id, { attributes: ['product_type'], transaction: t })
    if (p?.product_type === 'service') return false
  }
  return !!(item.variant_id || item.product_id)
}

async function loadReturnForMutation(id: string, ctx: TenantContext, t: Transaction) {
  const salesReturn = await SalesReturn.findOne({
    where: whereSalesDocumentScopeViaOrder(ctx, { id }),
    transaction: t,
    lock: t.LOCK.UPDATE,
  })
  if (!salesReturn) throw new Error('SALES_RETURN_NOT_FOUND')
  return salesReturn
}

async function getSalesReturnInTransaction(id: string, ctx: TenantContext, t: Transaction) {
  ensureSalesReturnAssociations()
  return SalesReturn.findOne({
    where: whereSalesDocumentScopeViaOrder(ctx, { id }),
    include: [
      { model: SalesReturnItem, as: 'items', order: [['sort_order', 'ASC']] },
      { model: SalesReturnExchangeItem, as: 'exchangeItems', order: [['sort_order', 'ASC']] },
      { model: CreditNote, as: 'creditNote', required: false },
    ],
    transaction: t,
  })
}

let associationsRegistered = false

export function ensureSalesReturnAssociations() {
  if (associationsRegistered) return
  associationsRegistered = true

  SalesReturn.belongsTo(SalesOrder, { foreignKey: 'order_id', as: 'order' })
  SalesOrder.hasMany(SalesReturn, { foreignKey: 'order_id', as: 'returns' })

  SalesReturn.belongsTo(Invoice, { foreignKey: 'invoice_id', as: 'invoice' })
  SalesReturn.belongsTo(CreditNote, { foreignKey: 'credit_note_id', as: 'creditNote' })
  SalesReturn.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' })
}
