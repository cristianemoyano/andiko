import 'server-only'
import { Op } from 'sequelize'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import PurchaseOrder from './purchase-order.model'
import PurchaseOrderItem from './purchase-order-item.model'
import type { PurchaseOrderInput, PurchaseOrderUpdateInput, PurchaseOrderQuery } from './purchase-order.schema'
import { buildBranchRenumberPatch, assertDraftBranchChange } from '@/lib/branch-document-renumber'
import { nextPurchaseDocNumber, calcLineItem, calcDocumentTotals } from './purchases.utils'
import { ensurePurchasesBranchAssociations } from './purchases-branch-associations'
import { whereAllowedBranches, type TenantContext } from '@/lib/tenancy'
import type { IvaRate } from '@/types'

export async function listPurchaseOrders(query: PurchaseOrderQuery, ctx: TenantContext) {
  ensurePurchasesBranchAssociations()

  const { page, limit, search, status, contact_id } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = whereAllowedBranches(ctx)
  if (status)     where.status     = status
  if (contact_id) where.contact_id = contact_id
  if (search) {
    where[Op.or as unknown as string] = [
      { order_number: { [Op.iLike]: `%${search}%` } },
    ]
  }

  const { default: Branch }  = await import('@/modules/auth/branch.model')
  const { default: Contact } = await import('@/modules/contacts/contact.model')
  const { default: User }    = await import('@/modules/auth/user.model')

  const { rows, count } = await PurchaseOrder.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'DESC']],
    attributes: [
      'id', 'branch_id', 'order_number', 'status', 'contact_id', 'buyer_id',
      'expected_date', 'payment_condition', 'currency',
      'subtotal', 'tax_amount', 'total', 'notes', 'created_at',
    ],
    include: [
      { model: Branch,  as: 'branch',  attributes: ['id', 'name', 'branch_code'] },
      { model: Contact, as: 'contact', attributes: ['id', 'legal_name', 'trade_name'], required: false },
      { model: User,    as: 'buyer',   attributes: ['id', 'name'] },
    ],
  })

  return toPaginated(rows, count, page, limit)
}

export async function getPurchaseOrder(id: string) {
  ensurePurchasesBranchAssociations()

  const { default: Branch }          = await import('@/modules/auth/branch.model')
  const { default: Contact }         = await import('@/modules/contacts/contact.model')
  const { default: User }            = await import('@/modules/auth/user.model')
  const { default: PurchaseReceipt } = await import('./purchase-receipt.model')
  const { default: SupplierInvoice } = await import('./supplier-invoice.model')

  const order = await PurchaseOrder.findByPk(id, {
    include: [
      { model: Branch,          as: 'branch',           attributes: ['id', 'name', 'branch_code'] },
      { model: Contact,         as: 'contact',          attributes: ['id', 'legal_name', 'trade_name'], required: false },
      { model: User,            as: 'buyer',            attributes: ['id', 'name'] },
      { model: PurchaseOrderItem, as: 'items',          order: [['sort_order', 'ASC']] },
      { model: PurchaseReceipt, as: 'receipts',         attributes: ['id', 'receipt_number', 'status', 'receipt_date'] },
      { model: SupplierInvoice, as: 'supplierInvoices', attributes: ['id', 'invoice_number', 'status', 'total'] },
    ],
  })
  if (!order) throw new Error('PURCHASE_ORDER_NOT_FOUND')
  return order
}

export async function createPurchaseOrder(input: PurchaseOrderInput, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const { items, branch_id, ...orderFields } = input

    const docNumber = await nextPurchaseDocNumber(orgId, branch_id, 'purchase_order', t)

    const lineTotals = items.map(item =>
      calcLineItem(item.quantity, item.unit_price, item.discount_pct, item.iva_rate as IvaRate),
    )
    const docTotals = calcDocumentTotals(lineTotals)

    const order = await PurchaseOrder.create(
      {
        ...orderFields,
        branch_id,
        org_id:       orgId,
        order_number: docNumber,
        buyer_id:     actorId,
        status:       'draft',
        created_by:   actorId,
        updated_by:   actorId,
      },
      { transaction: t },
    )

    await Promise.all(
      items.map((item, idx) =>
        PurchaseOrderItem.create(
          {
            order_id:        order.id,
            org_id:          orgId,
            product_id:      item.product_id ?? null,
            variant_id:      item.variant_id ?? null,
            description:     item.description,
            quantity:        String(item.quantity),
            unit_price:      String(item.unit_price),
            discount_pct:    String(item.discount_pct),
            iva_rate:        item.iva_rate as IvaRate,
            ...lineTotals[idx],
            sort_order:      item.sort_order,
            created_by:      actorId,
            updated_by:      actorId,
          },
          { transaction: t },
        ),
      ),
    )

    await order.update(docTotals, { transaction: t })

    logger.info({ orderId: order.id, orgId, number: docNumber }, 'purchase order created')
    return order
  })
}

export async function updatePurchaseOrder(id: string, input: PurchaseOrderUpdateInput, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const order = await PurchaseOrder.findOne({
      where: { id, org_id: orgId },
      transaction: t,
      lock: true,
    })
    if (!order) throw new Error('PURCHASE_ORDER_NOT_FOUND')
    if (order.status === 'received' || order.status === 'cancelled') {
      throw new Error('PURCHASE_ORDER_LOCKED')
    }

    const { items, branch_id: nextBranchId, ...fields } = input

    const branchPatch: Record<string, unknown> = {}
    if (nextBranchId && nextBranchId !== order.branch_id) {
      assertDraftBranchChange(order.status)
      Object.assign(branchPatch, await buildBranchRenumberPatch({
        orgId,
        currentBranchId: order.branch_id,
        nextBranchId,
        numberField: 'order_number',
        resolveNextNumber: (oid, branchId, tx) => nextPurchaseDocNumber(oid, branchId, 'purchase_order', tx),
        t,
      }))
    }

    if (items && items.length > 0) {
      await PurchaseOrderItem.destroy({ where: { order_id: id }, transaction: t })

      const lineTotals = items.map(item =>
        calcLineItem(item.quantity!, item.unit_price!, item.discount_pct ?? 0, (item.iva_rate ?? '21') as IvaRate),
      )
      const docTotals = calcDocumentTotals(lineTotals)

      await Promise.all(
        items.map((item, idx) =>
          PurchaseOrderItem.create(
            {
              order_id:     id,
              org_id:       orgId,
              product_id:   item.product_id ?? null,
              variant_id:   item.variant_id ?? null,
              description:  item.description!,
              quantity:     String(item.quantity),
              unit_price:   String(item.unit_price),
              discount_pct: String(item.discount_pct ?? 0),
              iva_rate:     (item.iva_rate ?? '21') as IvaRate,
              ...lineTotals[idx],
              sort_order:   item.sort_order ?? 0,
              created_by:   actorId,
              updated_by:   actorId,
            },
            { transaction: t },
          ),
        ),
      )

      await order.update({ ...fields, ...branchPatch, ...docTotals, updated_by: actorId }, { transaction: t })
    } else {
      await order.update({ ...fields, ...branchPatch, updated_by: actorId }, { transaction: t })
    }

    return order
  })
}

export async function deletePurchaseOrder(id: string, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const order = await PurchaseOrder.findOne({
      where: { id, org_id: orgId },
      transaction: t,
    })
    if (!order) throw new Error('PURCHASE_ORDER_NOT_FOUND')
    if (order.status !== 'draft') throw new Error('PURCHASE_ORDER_NOT_DRAFT')

    await order.update({ deleted_by: actorId }, { transaction: t })
    await order.destroy({ transaction: t })
  })
}

/**
 * Marks the order as `sent` (committed to supplier).
 */
export async function sendPurchaseOrder(id: string, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const order = await PurchaseOrder.findOne({
      where: { id, org_id: orgId },
      transaction: t,
      lock: true,
    })
    if (!order) throw new Error('PURCHASE_ORDER_NOT_FOUND')
    if (order.status !== 'draft') throw new Error('PURCHASE_ORDER_NOT_DRAFT')

    await order.update({ status: 'sent', updated_by: actorId }, { transaction: t })
    logger.info({ orderId: id }, 'purchase order sent')
    return order
  })
}

/**
 * Cancels a purchase order (only if draft or sent, and not yet received).
 */
export async function cancelPurchaseOrder(id: string, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const order = await PurchaseOrder.findOne({
      where: { id, org_id: orgId },
      transaction: t,
      lock: true,
    })
    if (!order) throw new Error('PURCHASE_ORDER_NOT_FOUND')
    if (order.status === 'received')  throw new Error('PURCHASE_ORDER_ALREADY_RECEIVED')
    if (order.status === 'cancelled') throw new Error('PURCHASE_ORDER_ALREADY_CANCELLED')

    await order.update({ status: 'cancelled', updated_by: actorId }, { transaction: t })
    logger.info({ orderId: id }, 'purchase order cancelled')
    return order
  })
}

/**
 * Recalculates purchase order status based on received quantities across all items.
 * Called internally after a receipt is confirmed.
 */
export async function recalcOrderReceiptStatus(orderId: string, orgId: string, t: import('sequelize').Transaction) {
  const order = await PurchaseOrder.findOne({
    where: { id: orderId, org_id: orgId },
    transaction: t,
    lock: true,
  })
  if (!order || order.status === 'cancelled') return

  const items = await PurchaseOrderItem.findAll({
    where: { order_id: orderId },
    attributes: ['quantity', 'received_qty'],
    transaction: t,
  })

  if (items.length === 0) return

  const allReceived    = items.every(i => parseFloat(i.received_qty) >= parseFloat(i.quantity))
  const someReceived   = items.some(i => parseFloat(i.received_qty) > 0)
  const newStatus      = allReceived ? 'received' : someReceived ? 'partially_received' : order.status

  if (newStatus !== order.status) {
    await order.update({ status: newStatus }, { transaction: t })
  }
}
