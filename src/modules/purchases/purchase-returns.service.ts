import 'server-only'
import type { Transaction } from 'sequelize'
import { Op } from 'sequelize'
import Decimal from 'decimal.js'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import { whereAllowedBranches, type TenantContext } from '@/lib/tenancy'
import PurchaseReturn from './purchase-return.model'
import PurchaseReturnItem, { type PurchaseReturnItemAttributes } from './purchase-return-item.model'
import PurchaseReturnExchangeItem, { type PurchaseReturnExchangeItemAttributes } from './purchase-return-exchange-item.model'
import PurchaseOrder from './purchase-order.model'
import PurchaseOrderItem from './purchase-order-item.model'
import SupplierInvoice from './supplier-invoice.model'
import Branch from '@/modules/auth/branch.model'
import { nextPurchaseDocNumber, calcLineItem, calcDocumentTotals } from './purchases.utils'
import { recalcOrderReturnStatus, RETURNABLE_PURCHASE_ORDER_STATUSES } from './purchase-orders.service'
import { recalcSupplierInvoiceBalance } from './supplier-invoices.service'
import { postPurchaseReturnAccounting } from '@/modules/accounting/purchase-return-accounting.service'
import { resolveWarehouseForBranch } from '@/modules/inventory/branch-warehouse.resolution'
import {
  deductStockForPurchaseReturn,
  addStockForPurchaseExchange,
  reverseStockForPurchaseReturn,
} from '@/modules/inventory/stock-movements.service'
import type {
  CreatePurchaseReturnInput,
  UpdatePurchaseReturnInput,
  CompletePurchaseReturnInput,
  PurchaseReturnQuery,
} from './purchase-return.schema'
import type { IvaRate } from '@/types'

function actorOf(ctx: TenantContext): string | null {
  return ctx.userId || null
}

function stockActorId(ctx: TenantContext): string {
  return actorOf(ctx) ?? ctx.orgId
}

export async function listPurchaseReturns(query: PurchaseReturnQuery, ctx: TenantContext) {
  ensurePurchaseReturnAssociations()
  const { offset, limit } = paginate(query.page, query.limit)
  const where: Record<string, unknown> = { ...whereAllowedBranches(ctx, {}) }
  if (query.status)         where.status         = query.status
  if (query.order_id)       where.order_id       = query.order_id
  if (query.operation_type) where.operation_type = query.operation_type
  if (query.search) {
    const term = `%${query.search}%`
    where[Op.or as unknown as string] = [
      { return_number: { [Op.iLike]: term } },
      { '$order.order_number$': { [Op.iLike]: term } },
    ]
  }

  const { rows, count } = await PurchaseReturn.findAndCountAll({
    where,
    subQuery: query.search ? false : undefined,
    attributes: [
      'id', 'return_number', 'operation_type', 'status', 'order_id', 'invoice_id',
      'returned_total', 'exchange_total', 'difference_total', 'completed_at', 'created_at',
    ],
    include: [
      { model: PurchaseOrder, as: 'order', attributes: ['id', 'order_number', 'status'], required: false },
    ],
    order: [['created_at', 'DESC']],
    limit,
    offset,
  })

  return toPaginated(rows, count, query.page, query.limit)
}

export async function getPurchaseReturn(id: string, ctx: TenantContext) {
  ensurePurchaseReturnAssociations()

  const row = await PurchaseReturn.findOne({
    where: whereAllowedBranches(ctx, { id }),
    include: [
      { model: Branch, as: 'branch', attributes: ['id', 'name', 'branch_code'], required: false },
      { model: PurchaseOrder, as: 'order', attributes: ['id', 'order_number', 'status', 'contact_id'], required: false },
      { model: SupplierInvoice, as: 'invoice', attributes: ['id', 'invoice_number', 'status', 'total', 'balance'], required: false },
      { model: PurchaseReturnItem, as: 'items', order: [['sort_order', 'ASC']] },
      { model: PurchaseReturnExchangeItem, as: 'exchangeItems', order: [['sort_order', 'ASC']] },
    ],
  })
  if (!row) throw new Error('PURCHASE_RETURN_NOT_FOUND')
  return row
}

export async function createPurchaseReturn(input: CreatePurchaseReturnInput, ctx: TenantContext) {
  const { orgId } = ctx
  const actorId = actorOf(ctx)
  if (!orgId) throw new Error('ORG_CONTEXT_REQUIRED')

  return sequelize.transaction(async (t) => {
    const order = await PurchaseOrder.findOne({
      where: whereAllowedBranches(ctx, { id: input.order_id }),
      transaction: t,
      lock: t.LOCK.UPDATE,
    })
    if (!order) throw new Error('ORDER_NOT_FOUND')
    if (!RETURNABLE_PURCHASE_ORDER_STATUSES.includes(order.status)) {
      throw new Error('ORDER_NOT_RETURNABLE')
    }
    if (!order.branch_id) throw new Error('ORDER_BRANCH_REQUIRED')

    // An order may have several supplier invoices; pick the most recent open one
    // deterministically so the return credits a stable payable.
    const invoice = await SupplierInvoice.findOne({
      where: {
        order_id: order.id,
        org_id: orgId,
        status: { [Op.notIn]: ['cancelled', 'draft'] },
      },
      attributes: ['id'],
      order: [['created_at', 'DESC']],
      transaction: t,
    })

    const warehouseId = input.warehouse_id
      ?? await resolveWarehouseForBranch(order.branch_id, orgId, t)

    const return_number = await nextPurchaseDocNumber(orgId, order.branch_id, 'purchase_return', t)
    const { returnedTotals, exchangeTotals, differenceTotal, returnItems, exchangeItems } =
      await buildReturnLines(input, order.id, t)

    const purchaseReturn = await PurchaseReturn.create(
      {
        org_id:            orgId,
        branch_id:         order.branch_id,
        order_id:          order.id,
        invoice_id:        invoice?.id ?? null,
        warehouse_id:      warehouseId,
        return_number,
        operation_type:    input.operation_type,
        status:            'draft',
        returned_subtotal: returnedTotals.subtotal,
        returned_discount: returnedTotals.discount_amount,
        returned_tax:      returnedTotals.tax_amount,
        returned_total:    returnedTotals.total,
        exchange_subtotal: exchangeTotals.subtotal,
        exchange_discount: exchangeTotals.discount_amount,
        exchange_tax:      exchangeTotals.tax_amount,
        exchange_total:    exchangeTotals.total,
        difference_total:  differenceTotal,
        reason:            input.reason ?? null,
        notes:             input.notes ?? null,
        created_by:        actorId,
        updated_by:        actorId,
      },
      { transaction: t },
    )

    await PurchaseReturnItem.bulkCreate(
      returnItems.map((item, idx) => ({
        ...item,
        return_id:  purchaseReturn.id,
        org_id:     orgId,
        sort_order: idx,
        created_by: actorId,
        updated_by: actorId,
      })),
      { transaction: t },
    )

    if (exchangeItems.length > 0) {
      await PurchaseReturnExchangeItem.bulkCreate(
        exchangeItems.map((item, idx) => ({
          ...item,
          return_id:  purchaseReturn.id,
          org_id:     orgId,
          sort_order: idx,
          created_by: actorId,
          updated_by: actorId,
        })),
        { transaction: t },
      )
    }

    logger.info({ returnId: purchaseReturn.id, return_number, orderId: order.id }, 'purchase return created')
    return getPurchaseReturnInTransaction(purchaseReturn.id, ctx, t)
  })
}

export async function updatePurchaseReturn(id: string, input: UpdatePurchaseReturnInput, ctx: TenantContext) {
  return sequelize.transaction(async (t) => {
    const purchaseReturn = await PurchaseReturn.findOne({
      where: whereAllowedBranches(ctx, { id }),
      transaction: t,
      lock: t.LOCK.UPDATE,
    })
    if (!purchaseReturn) throw new Error('PURCHASE_RETURN_NOT_FOUND')
    if (purchaseReturn.status !== 'draft') throw new Error('PURCHASE_RETURN_NOT_EDITABLE')

    if (input.items) {
      const built = await buildReturnLines(
        {
          items:          input.items,
          exchange_items: input.exchange_items ?? [],
          operation_type: purchaseReturn.operation_type,
        },
        purchaseReturn.order_id,
        t,
      )

      await PurchaseReturnItem.destroy({ where: { return_id: id }, transaction: t, force: false })
      await PurchaseReturnExchangeItem.destroy({ where: { return_id: id }, transaction: t, force: false })

      await PurchaseReturnItem.bulkCreate(
        built.returnItems.map((item, idx) => ({
          ...item,
          return_id:  id,
          org_id:     ctx.orgId,
          sort_order: idx,
          created_by: actorOf(ctx),
          updated_by: actorOf(ctx),
        })),
        { transaction: t },
      )

      if (built.exchangeItems.length > 0) {
        await PurchaseReturnExchangeItem.bulkCreate(
          built.exchangeItems.map((item, idx) => ({
            ...item,
            return_id:  id,
            org_id:     ctx.orgId,
            sort_order: idx,
            created_by: actorOf(ctx),
            updated_by: actorOf(ctx),
          })),
          { transaction: t },
        )
      }

      await purchaseReturn.update({
        returned_subtotal: built.returnedTotals.subtotal,
        returned_discount: built.returnedTotals.discount_amount,
        returned_tax:      built.returnedTotals.tax_amount,
        returned_total:    built.returnedTotals.total,
        exchange_subtotal: built.exchangeTotals.subtotal,
        exchange_discount: built.exchangeTotals.discount_amount,
        exchange_tax:      built.exchangeTotals.tax_amount,
        exchange_total:    built.exchangeTotals.total,
        difference_total:  built.differenceTotal,
        warehouse_id:      input.warehouse_id ?? purchaseReturn.warehouse_id,
        reason:            input.reason ?? purchaseReturn.reason,
        notes:             input.notes ?? purchaseReturn.notes,
        updated_by:        actorOf(ctx),
      }, { transaction: t })
    } else {
      await purchaseReturn.update({
        warehouse_id: input.warehouse_id ?? purchaseReturn.warehouse_id,
        reason:       input.reason ?? purchaseReturn.reason,
        notes:        input.notes ?? purchaseReturn.notes,
        updated_by:   actorOf(ctx),
      }, { transaction: t })
    }

    return getPurchaseReturnInTransaction(id, ctx, t)
  })
}

export async function confirmPurchaseReturn(id: string, ctx: TenantContext) {
  return sequelize.transaction(async (t) => {
    const purchaseReturn = await loadReturnForMutation(id, ctx, t)
    if (purchaseReturn.status !== 'draft') throw new Error('PURCHASE_RETURN_ALREADY_CONFIRMED')

    await deductStockForPurchaseReturn(id, ctx.orgId!, stockActorId(ctx), t)
    if (purchaseReturn.operation_type === 'exchange') {
      await addStockForPurchaseExchange(id, ctx.orgId!, stockActorId(ctx), t)
    }
    await applyReturnedQty(purchaseReturn, t, actorOf(ctx))

    await purchaseReturn.update(
      { status: 'confirmed', updated_by: actorOf(ctx) },
      { transaction: t },
    )

    return getPurchaseReturnInTransaction(id, ctx, t)
  })
}

export async function completePurchaseReturn(id: string, input: CompletePurchaseReturnInput, ctx: TenantContext) {
  return sequelize.transaction(async (t) => {
    const purchaseReturn = await loadReturnForMutation(id, ctx, t)
    if (purchaseReturn.status === 'completed') throw new Error('PURCHASE_RETURN_ALREADY_COMPLETED')
    if (purchaseReturn.status === 'cancelled') throw new Error('PURCHASE_RETURN_CANCELLED')

    if (purchaseReturn.status === 'draft') {
      await deductStockForPurchaseReturn(id, ctx.orgId!, stockActorId(ctx), t)
      if (purchaseReturn.operation_type === 'exchange') {
        await addStockForPurchaseExchange(id, ctx.orgId!, stockActorId(ctx), t)
      }
      await applyReturnedQty(purchaseReturn, t, actorOf(ctx))
      await purchaseReturn.update({ status: 'confirmed' }, { transaction: t })
    }

    await purchaseReturn.update({
      status:       'completed',
      completed_at: new Date(),
      notes:        input.notes ?? purchaseReturn.notes,
      updated_by:   actorOf(ctx),
    }, { transaction: t })

    if (purchaseReturn.invoice_id) {
      await recalcSupplierInvoiceBalance(purchaseReturn.invoice_id, t)
    }
    await recalcOrderReturnStatus(purchaseReturn.order_id, ctx.orgId!, t)
    await postPurchaseReturnAccounting(id, ctx, t)

    logger.info({ returnId: id }, 'purchase return completed')
    return getPurchaseReturnInTransaction(id, ctx, t)
  })
}

export async function cancelPurchaseReturn(id: string, ctx: TenantContext) {
  return sequelize.transaction(async (t) => {
    const purchaseReturn = await loadReturnForMutation(id, ctx, t)
    if (purchaseReturn.status === 'cancelled') throw new Error('PURCHASE_RETURN_ALREADY_CANCELLED')
    if (purchaseReturn.status === 'completed') throw new Error('PURCHASE_RETURN_ALREADY_COMPLETED')

    if (purchaseReturn.status === 'confirmed') {
      await reverseReturnedQty(purchaseReturn, t, actorOf(ctx))
      await reverseStockForPurchaseReturn(id, ctx.orgId!, stockActorId(ctx), t)
    }

    await purchaseReturn.update(
      { status: 'cancelled', updated_by: actorOf(ctx) },
      { transaction: t },
    )

    await recalcOrderReturnStatus(purchaseReturn.order_id, ctx.orgId!, t)
    return getPurchaseReturnInTransaction(id, ctx, t)
  })
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/** Resolves an order line for a return; falls back to product/description matching. */
function resolveOrderItemForReturn(
  line: CreatePurchaseReturnInput['items'][number],
  orderItems: PurchaseOrderItem[],
  orderItemMap: Map<string, PurchaseOrderItem>,
): PurchaseOrderItem | undefined {
  if (line.order_item_id) {
    const hit = orderItemMap.get(line.order_item_id)
    if (hit) return hit
  }

  if (line.product_id) {
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
    items: CreatePurchaseReturnInput['items']
    exchange_items?: CreatePurchaseReturnInput['exchange_items']
    operation_type?: CreatePurchaseReturnInput['operation_type']
  },
  orderId: string,
  t: Transaction,
) {
  const orderItems = await PurchaseOrderItem.findAll({
    where: { order_id: orderId },
    transaction: t,
  })
  const orderItemMap = new Map(orderItems.map(i => [String(i.id), i]))

  const returnLineTotals = []
  const returnItems: Array<Omit<PurchaseReturnItemAttributes, 'id' | 'return_id' | 'org_id' | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'>> = []

  for (const [idx, line] of input.items.entries()) {
    const orderItem = resolveOrderItemForReturn(line, orderItems, orderItemMap)
    if (!orderItem) throw new Error('ORDER_ITEM_NOT_FOUND')

    const alreadyReturned = new Decimal(orderItem.returned_qty ?? '0')
    // Can only return what was actually received and not already returned.
    const maxReturnable = new Decimal(orderItem.received_qty ?? '0').minus(alreadyReturned)
    const qty = new Decimal(line.quantity)
    if (qty.gt(maxReturnable)) throw new Error('RETURN_QUANTITY_EXCEEDS_AVAILABLE')

    const totals = calcLineItem(
      line.quantity,
      orderItem.unit_price,
      orderItem.discount_pct,
      orderItem.iva_rate as IvaRate,
    )
    returnLineTotals.push(totals)

    returnItems.push({
      order_item_id: orderItem.id,
      product_id:    orderItem.product_id,
      variant_id:    orderItem.variant_id,
      description:   orderItem.description,
      quantity:      String(line.quantity),
      unit_price:    orderItem.unit_price,
      discount_pct:  orderItem.discount_pct,
      iva_rate:      orderItem.iva_rate,
      batch_code:    line.batch_code ?? null,
      expiry_date:   line.expiry_date ?? null,
      sort_order:    idx,
      ...totals,
    })
  }

  const returnedTotals = calcDocumentTotals(returnLineTotals)

  const exchangeLineTotals = []
  const exchangeItems: Array<Omit<PurchaseReturnExchangeItemAttributes, 'id' | 'return_id' | 'org_id' | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'>> = []

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
      batch_code:   line.batch_code ?? null,
      expiry_date:  line.expiry_date ?? null,
      sort_order:   line.sort_order ?? idx,
      ...totals,
    })
  }

  const exchangeTotals = exchangeLineTotals.length > 0
    ? calcDocumentTotals(exchangeLineTotals)
    : { subtotal: '0.00', discount_amount: '0.00', tax_amount: '0.00', total: '0.00' }

  // Positive difference = replacement goods cost more than what we returned.
  const differenceTotal = new Decimal(exchangeTotals.total).minus(returnedTotals.total).toFixed(2)

  return { returnedTotals, exchangeTotals, differenceTotal, returnItems, exchangeItems }
}

async function applyReturnedQty(purchaseReturn: PurchaseReturn, t: Transaction, actorId: string | null) {
  const items = await PurchaseReturnItem.findAll({
    where: { return_id: purchaseReturn.id },
    transaction: t,
  })

  for (const item of items) {
    const orderItem = await PurchaseOrderItem.findByPk(item.order_item_id, { transaction: t, lock: t.LOCK.UPDATE })
    if (!orderItem) continue
    const next = new Decimal(orderItem.returned_qty ?? '0').plus(item.quantity)
    await orderItem.update({ returned_qty: next.toFixed(4), updated_by: actorId }, { transaction: t })
  }
}

async function reverseReturnedQty(purchaseReturn: PurchaseReturn, t: Transaction, actorId: string | null) {
  const items = await PurchaseReturnItem.findAll({
    where: { return_id: purchaseReturn.id },
    transaction: t,
  })

  for (const item of items) {
    const orderItem = await PurchaseOrderItem.findByPk(item.order_item_id, { transaction: t, lock: t.LOCK.UPDATE })
    if (!orderItem) continue
    const next = Decimal.max(new Decimal(orderItem.returned_qty ?? '0').minus(item.quantity), new Decimal(0))
    await orderItem.update({ returned_qty: next.toFixed(4), updated_by: actorId }, { transaction: t })
  }
}

async function loadReturnForMutation(id: string, ctx: TenantContext, t: Transaction) {
  const purchaseReturn = await PurchaseReturn.findOne({
    where: whereAllowedBranches(ctx, { id }),
    transaction: t,
    lock: t.LOCK.UPDATE,
  })
  if (!purchaseReturn) throw new Error('PURCHASE_RETURN_NOT_FOUND')
  return purchaseReturn
}

async function getPurchaseReturnInTransaction(id: string, ctx: TenantContext, t: Transaction) {
  ensurePurchaseReturnAssociations()
  return PurchaseReturn.findOne({
    where: whereAllowedBranches(ctx, { id }),
    include: [
      { model: PurchaseReturnItem, as: 'items', order: [['sort_order', 'ASC']] },
      { model: PurchaseReturnExchangeItem, as: 'exchangeItems', order: [['sort_order', 'ASC']] },
      { model: SupplierInvoice, as: 'invoice', attributes: ['id', 'invoice_number', 'status', 'total', 'balance'], required: false },
    ],
    transaction: t,
  })
}

let associationsRegistered = false

export function ensurePurchaseReturnAssociations() {
  if (associationsRegistered) return
  associationsRegistered = true

  PurchaseReturn.belongsTo(PurchaseOrder, { foreignKey: 'order_id', as: 'order' })
  PurchaseOrder.hasMany(PurchaseReturn, { foreignKey: 'order_id', as: 'returns' })

  PurchaseReturn.belongsTo(SupplierInvoice, { foreignKey: 'invoice_id', as: 'invoice' })
  PurchaseReturn.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' })
}
