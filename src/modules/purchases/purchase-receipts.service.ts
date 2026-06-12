import 'server-only'
import { Op } from 'sequelize'
import Decimal from 'decimal.js'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import PurchaseReceipt from './purchase-receipt.model'
import PurchaseReceiptItem from './purchase-receipt-item.model'
import PurchaseOrderItem from './purchase-order-item.model'
import type { PurchaseReceiptInput, PurchaseReceiptUpdateInput, PurchaseReceiptQuery } from './purchase-receipt.schema'
import { nextPurchaseDocNumber } from './purchases.utils'
import { ensurePurchasesBranchAssociations } from './purchases-branch-associations'
import { recalcOrderReceiptStatus } from './purchase-orders.service'

export async function listPurchaseReceipts(query: PurchaseReceiptQuery, orgId: string) {
  ensurePurchasesBranchAssociations()

  const { page, limit, search, status, contact_id, order_id, warehouse_id } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = { org_id: orgId }
  if (status)       where.status       = status
  if (contact_id)   where.contact_id   = contact_id
  if (order_id)     where.order_id     = order_id
  if (warehouse_id) where.warehouse_id = warehouse_id
  if (search) {
    where[Op.or as unknown as string] = [
      { receipt_number: { [Op.iLike]: `%${search}%` } },
    ]
  }

  const { default: Branch }    = await import('@/modules/auth/branch.model')
  const { default: Contact }   = await import('@/modules/contacts/contact.model')
  const { default: Warehouse } = await import('@/modules/inventory/warehouse.model')

  const { rows, count } = await PurchaseReceipt.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'DESC']],
    attributes: [
      'id', 'branch_id', 'receipt_number', 'status', 'contact_id',
      'order_id', 'warehouse_id', 'receipt_date', 'notes', 'created_at',
    ],
    include: [
      { model: Branch,    as: 'branch',    attributes: ['id', 'name', 'branch_code'] },
      { model: Contact,   as: 'contact',   attributes: ['id', 'legal_name', 'trade_name'], required: false },
      { model: Warehouse, as: 'warehouse', attributes: ['id', 'name'], required: false },
    ],
  })

  return toPaginated(rows, count, page, limit)
}

export async function getPurchaseReceipt(id: string) {
  ensurePurchasesBranchAssociations()

  const { default: Branch }          = await import('@/modules/auth/branch.model')
  const { default: Contact }         = await import('@/modules/contacts/contact.model')
  const { default: Warehouse }       = await import('@/modules/inventory/warehouse.model')
  const { default: User }            = await import('@/modules/auth/user.model')
  const { default: PurchaseOrder }   = await import('./purchase-order.model')
  const { default: SupplierInvoice } = await import('./supplier-invoice.model')

  const receipt = await PurchaseReceipt.findByPk(id, {
    include: [
      { model: Branch,          as: 'branch',           attributes: ['id', 'name', 'branch_code'] },
      { model: Contact,         as: 'contact',          attributes: ['id', 'legal_name', 'trade_name'], required: false },
      { model: Warehouse,       as: 'warehouse',        attributes: ['id', 'name'], required: false },
      { model: User,            as: 'buyer',            attributes: ['id', 'name'] },
      { model: PurchaseReceiptItem, as: 'items',        order: [['sort_order', 'ASC']] },
      { model: PurchaseOrder,   as: 'order',            attributes: ['id', 'order_number', 'status'], required: false },
      { model: SupplierInvoice, as: 'supplierInvoices', attributes: ['id', 'invoice_number', 'status', 'total'] },
    ],
  })
  if (!receipt) throw new Error('PURCHASE_RECEIPT_NOT_FOUND')
  return receipt
}

export async function createPurchaseReceipt(input: PurchaseReceiptInput, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const { items, branch_id, ...receiptFields } = input

    const docNumber = await nextPurchaseDocNumber(orgId, branch_id, 'receipt', t)

    const receipt = await PurchaseReceipt.create(
      {
        ...receiptFields,
        branch_id,
        org_id:         orgId,
        receipt_number: docNumber,
        buyer_id:       actorId,
        status:         'draft',
        created_by:     actorId,
        updated_by:     actorId,
      },
      { transaction: t },
    )

    await Promise.all(
      items.map((item, idx) =>
        PurchaseReceiptItem.create(
          {
            receipt_id:    receipt.id,
            org_id:        orgId,
            order_item_id: item.order_item_id ?? null,
            product_id:    item.product_id ?? null,
            variant_id:    item.variant_id ?? null,
            description:   item.description,
            quantity:      String(item.quantity),
            unit_cost:     String(item.unit_cost ?? 0),
            sort_order:    idx,
            batch_code:    item.batch_code ?? null,
            expiry_date:   item.expiry_date ?? null,
            created_by:    actorId,
            updated_by:    actorId,
          },
          { transaction: t },
        ),
      ),
    )

    logger.info({ receiptId: receipt.id, orgId, number: docNumber }, 'purchase receipt created')
    return receipt
  })
}

export async function updatePurchaseReceipt(id: string, input: PurchaseReceiptUpdateInput, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const receipt = await PurchaseReceipt.findOne({
      where: { id, org_id: orgId },
      transaction: t,
      lock: true,
    })
    if (!receipt) throw new Error('PURCHASE_RECEIPT_NOT_FOUND')
    if (receipt.status !== 'draft') throw new Error('PURCHASE_RECEIPT_NOT_DRAFT')

    const { items, ...fields } = input

    if (items && items.length > 0) {
      await PurchaseReceiptItem.destroy({ where: { receipt_id: id }, transaction: t })
      await Promise.all(
        items.map((item, idx) =>
          PurchaseReceiptItem.create(
            {
              receipt_id:    id,
              org_id:        orgId,
              order_item_id: item.order_item_id ?? null,
              product_id:    item.product_id ?? null,
              variant_id:    item.variant_id ?? null,
              description:   item.description!,
              quantity:      String(item.quantity),
              unit_cost:     String(item.unit_cost ?? 0),
              sort_order:    idx,
              batch_code:    item.batch_code ?? null,
              expiry_date:   item.expiry_date ?? null,
              created_by:    actorId,
              updated_by:    actorId,
            },
            { transaction: t },
          ),
        ),
      )
    }

    await receipt.update({ ...fields, updated_by: actorId }, { transaction: t })
    return receipt
  })
}

export async function deletePurchaseReceipt(id: string, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const receipt = await PurchaseReceipt.findOne({
      where: { id, org_id: orgId },
      transaction: t,
    })
    if (!receipt) throw new Error('PURCHASE_RECEIPT_NOT_FOUND')
    if (receipt.status !== 'draft') throw new Error('PURCHASE_RECEIPT_NOT_DRAFT')

    await receipt.update({ deleted_by: actorId }, { transaction: t })
    await receipt.destroy({ transaction: t })
  })
}

/**
 * Confirms a draft receipt:
 * 1. Adds stock to the target warehouse for each variant item via `applyMovement`.
 * 2. Updates `received_qty` on matching purchase order items.
 * 3. Recalculates purchase order status (draft → partially_received → received).
 */
export async function confirmPurchaseReceipt(id: string, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    // Lock only the parent row — including associations with FOR UPDATE causes a PostgreSQL
    // error ("FOR UPDATE cannot be applied to the nullable side of an outer join").
    const receipt = await PurchaseReceipt.findOne({
      where: { id, org_id: orgId },
      transaction: t,
      lock: true,
    })
    if (!receipt) throw new Error('PURCHASE_RECEIPT_NOT_FOUND')
    if (receipt.status !== 'draft') throw new Error('PURCHASE_RECEIPT_NOT_DRAFT')
    if (!receipt.warehouse_id)      throw new Error('PURCHASE_RECEIPT_NO_WAREHOUSE')

    // Load items in a separate query (no lock needed)
    const items = await PurchaseReceiptItem.findAll({
      where: { receipt_id: id },
      transaction: t,
    })

    const { applyMovement }           = await import('@/modules/inventory/stock-movements.service')
    const { default: ProductVariant } = await import('@/modules/catalog/product-variant.model')
    const { default: Product }        = await import('@/modules/catalog/product.model')

    for (const item of items) {
      if (!item.variant_id) continue

      const variant = await ProductVariant.findByPk(item.variant_id, {
        attributes: ['id', 'manage_stock'],
        transaction: t,
      })
      if (!variant?.manage_stock) continue

      const product = item.product_id
        ? await Product.findByPk(item.product_id, { attributes: ['product_type'], transaction: t })
        : null
      if (product?.product_type === 'service') continue

      await applyMovement(
        {
          variantId:     item.variant_id,
          warehouseId:   receipt.warehouse_id,
          orgId,
          movementType:  'in',
          referenceType: 'purchase_receipt',
          referenceId:   receipt.id,
          quantityDelta: new Decimal(item.quantity),
          batchCode:     item.batch_code ?? null,
          expiryDate:    item.expiry_date ?? null,
          notes:         `Recepción ${receipt.receipt_number}`,
          actorId,
        },
        t,
      )

      if (item.order_item_id) {
        const orderItem = await PurchaseOrderItem.findByPk(item.order_item_id, { transaction: t })
        if (orderItem) {
          const newReceived = new Decimal(orderItem.received_qty).plus(item.quantity)
          await orderItem.update({ received_qty: newReceived.toFixed(4) }, { transaction: t })
        }
      }
    }

    await receipt.update({ status: 'confirmed', updated_by: actorId }, { transaction: t })

    if (receipt.order_id) {
      await recalcOrderReceiptStatus(receipt.order_id, orgId, t)
    }

    logger.info({ receiptId: id, orgId }, 'purchase receipt confirmed — stock added')
    return receipt
  })
}
