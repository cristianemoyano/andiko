import 'server-only'
import { Op } from 'sequelize'
import type { Transaction } from 'sequelize'
import Decimal from 'decimal.js'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import DeliveryNote from './delivery-note.model'
import DeliveryNoteItem from './delivery-note-item.model'
import StockMovement from './stock-movement.model'
import { buildBranchRenumberPatch, assertDraftBranchChange } from '@/lib/branch-document-renumber'
import { applyMovement } from './stock-movements.service'
import { resolveWarehouseForBranch } from './branch-warehouse.resolution'
import { nextDeliveryNumber } from './delivery-notes.utils'
import { ensureDeliveryNoteAssociations } from './delivery-note-associations'
import CarrierAccount from '@/modules/logistics/carrier-account.model'
import Branch from '@/modules/auth/branch.model'
import Contact from '@/modules/contacts/contact.model'
import User from '@/modules/auth/user.model'
import Warehouse from './warehouse.model'
import SalesOrder from '@/modules/sales/sales-order.model'
import SalesOrderItem from '@/modules/sales/sales-order-item.model'
import Shipment from '@/modules/logistics/shipment.model'
import ShipmentItem from '@/modules/logistics/shipment-item.model'
import type { DeliveryNoteInput, DeliveryNoteUpdateInput, DeliveryNoteQuery } from './delivery-note.schema'

/**
 * Determines whether issuing this delivery note should deduct stock.
 *
 * The sales flow already deducts stock when an order is *confirmed*
 * (`deductStockForOrder`, reference_type `order`). A delivery note created from
 * such an order must NOT deduct stock again — it only documents what was
 * physically delivered. When the linked order never deducted stock (or the
 * note is standalone), the delivery note becomes the document that moves stock.
 */
async function orderAlreadyDeductedStock(orderId: string, orgId: string, t: Transaction): Promise<boolean> {
  const count = await StockMovement.count({
    where: { reference_type: 'order', reference_id: orderId, movement_type: 'out', org_id: orgId },
    transaction: t,
  })
  return count > 0
}

async function resolveCarrierFields(
  carrierAccountId: string | null | undefined,
  orgId: string,
  branchId: string,
  t: Transaction,
): Promise<{ carrier_account_id: string | null; carrier: string | null }> {
  if (!carrierAccountId) {
    return { carrier_account_id: null, carrier: null }
  }

  const account = await CarrierAccount.findOne({
    where: {
      id: carrierAccountId,
      org_id: orgId,
      is_active: true,
      [Op.or]: [{ branch_id: branchId }, { branch_id: null }],
    },
    attributes: ['id', 'name'],
    transaction: t,
  })
  if (!account) throw new Error('CARRIER_ACCOUNT_NOT_FOUND')

  return { carrier_account_id: account.id, carrier: account.name }
}

function formatShipmentAddress(shipment: Shipment): string | null {
  const first = `${shipment.ship_street ?? ''}${shipment.ship_number ? ` ${shipment.ship_number}` : ''}`.trim()
  const floorApt = [shipment.ship_floor, shipment.ship_apartment].filter(Boolean).join(' ')
  const parts = [first, floorApt, shipment.ship_city, shipment.ship_province, shipment.ship_postal_code, shipment.ship_country].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
}

async function loadShipmentForDeliveryNote(
  shipmentId: string,
  orgId: string,
  t: Transaction,
): Promise<Shipment> {
  const shipment = await Shipment.findOne({
    where: { id: shipmentId, org_id: orgId },
    transaction: t,
    lock: t.LOCK.UPDATE,
  })
  if (!shipment) throw new Error('SHIPMENT_NOT_FOUND')
  return shipment
}

async function assertDeliveryNoteShipmentLink(
  shipmentId: string | null | undefined,
  orderId: string | null | undefined,
  branchId: string,
  orgId: string,
  t: Transaction,
  ignoreDeliveryNoteId?: string,
): Promise<Shipment | null> {
  if (!shipmentId) return null

  const shipment = await loadShipmentForDeliveryNote(shipmentId, orgId, t)
  if (shipment.branch_id !== branchId) throw new Error('DELIVERY_NOTE_SHIPMENT_BRANCH_MISMATCH')
  if (orderId && shipment.sales_order_id !== orderId) throw new Error('DELIVERY_NOTE_SHIPMENT_ORDER_MISMATCH')

  const existing = await DeliveryNote.findOne({
    where: {
      shipment_id: shipmentId,
      org_id: orgId,
      status: { [Op.ne]: 'annulled' },
    },
    attributes: ['id'],
    transaction: t,
    lock: t.LOCK.UPDATE,
  })
  if (existing && existing.id !== ignoreDeliveryNoteId) throw new Error('DELIVERY_NOTE_SHIPMENT_ALREADY_LINKED')

  return shipment
}

export async function assertShipmentHasIssuedDeliveryNote(
  shipmentId: string,
  orgId: string,
  t?: Transaction,
): Promise<void> {
  const note = await DeliveryNote.findOne({
    where: {
      shipment_id: shipmentId,
      org_id: orgId,
      status: { [Op.in]: ['issued', 'delivered'] },
    },
    attributes: ['id'],
    transaction: t,
  })
  if (!note) throw new Error('SHIPMENT_DELIVERY_NOTE_REQUIRED')
}

export async function listDeliveryNotes(query: DeliveryNoteQuery, orgId: string) {
  ensureDeliveryNoteAssociations()

  const { page, limit, search, status, contact_id, order_id, warehouse_id, shipment_id } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = { org_id: orgId }
  if (status)       where.status       = status
  if (contact_id)   where.contact_id   = contact_id
  if (order_id)     where.order_id     = order_id
  if (warehouse_id) where.warehouse_id = warehouse_id
  if (shipment_id)  where.shipment_id  = shipment_id
  if (search) {
    where[Op.or as unknown as string] = [
      { delivery_number: { [Op.iLike]: `%${search}%` } },
    ]
  }

  const { rows, count } = await DeliveryNote.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'DESC']],
    attributes: [
      'id', 'branch_id', 'delivery_number', 'status', 'contact_id',
      'order_id', 'shipment_id', 'warehouse_id', 'delivery_date', 'deducts_stock', 'notes', 'created_at',
    ],
    include: [
      { model: Branch,    as: 'branch',    attributes: ['id', 'name', 'branch_code'] },
      { model: Contact,   as: 'contact',   attributes: ['id', 'legal_name', 'trade_name'], required: false },
      { model: Warehouse, as: 'warehouse', attributes: ['id', 'name'], required: false },
    ],
  })

  return toPaginated(rows, count, page, limit)
}

export async function getDeliveryNote(id: string, orgId: string) {
  ensureDeliveryNoteAssociations()

  const note = await DeliveryNote.findByPk(id, {
    include: [
      { model: Branch,           as: 'branch',    attributes: ['id', 'name', 'branch_code'] },
      { model: Contact,          as: 'contact',   attributes: ['id', 'legal_name', 'trade_name'], required: false },
      { model: Warehouse,        as: 'warehouse', attributes: ['id', 'name'], required: false },
      { model: User,             as: 'issuer',    attributes: ['id', 'name'], required: false },
      { model: CarrierAccount,   as: 'carrierAccount', attributes: ['id', 'name', 'kind'], required: false },
      { model: DeliveryNoteItem, as: 'items' },
      { model: SalesOrder,       as: 'order',     attributes: ['id', 'order_number', 'status'], required: false },
      { model: Shipment,         as: 'shipment',  attributes: ['id', 'shipment_number', 'status'], required: false },
    ],
    order: [[{ model: DeliveryNoteItem, as: 'items' }, 'sort_order', 'ASC']],
  })
  if (!note) throw new Error('DELIVERY_NOTE_NOT_FOUND')
  if (note.org_id !== orgId) throw new Error('DELIVERY_NOTE_NOT_FOUND')
  return note
}

export async function createDeliveryNote(input: DeliveryNoteInput, orgId: string, actorId: string) {
  ensureDeliveryNoteAssociations()

  return sequelize.transaction(async (t) => {
    const { items, branch_id, carrier_account_id, shipment_id, ...fields } = input

    const docNumber = await nextDeliveryNumber(orgId, branch_id, t)
    const shipment = await assertDeliveryNoteShipmentLink(shipment_id, fields.order_id, branch_id, orgId, t)

    let warehouseId = fields.warehouse_id ?? shipment?.warehouse_id ?? null
    if (!warehouseId) {
      try {
        warehouseId = await resolveWarehouseForBranch(branch_id, orgId, t)
      } catch {
        // Borrador sin depósito; al emitir se resuelve de nuevo si hace falta.
      }
    }

    const carrierFields = await resolveCarrierFields(carrier_account_id, orgId, branch_id, t)

    // If linked to an order that already deducted stock on confirmation, this
    // note only documents the delivery and must not move stock again.
    const deductsStock = fields.order_id
      ? !(await orderAlreadyDeductedStock(fields.order_id, orgId, t))
      : true

    const note = await DeliveryNote.create(
      {
        ...fields,
        ...carrierFields,
        order_id:        fields.order_id ?? shipment?.sales_order_id ?? null,
        shipment_id:     shipment?.id ?? shipment_id ?? null,
        warehouse_id:    warehouseId,
        branch_id,
        org_id:          orgId,
        delivery_number: docNumber,
        issued_by:       actorId,
        status:          'draft',
        deducts_stock:   deductsStock,
        created_by:      actorId,
        updated_by:      actorId,
      },
      { transaction: t },
    )

    await Promise.all(
      items.map((item, idx) =>
        DeliveryNoteItem.create(
          {
            delivery_note_id: note.id,
            org_id:           orgId,
            shipment_item_id: item.shipment_item_id ?? null,
            order_item_id:    item.order_item_id ?? null,
            product_id:       item.product_id ?? null,
            variant_id:       item.variant_id ?? null,
            description:      item.description,
            quantity:         String(item.quantity),
            sort_order:       item.sort_order ?? idx,
            created_by:       actorId,
            updated_by:       actorId,
          },
          { transaction: t },
        ),
      ),
    )

    logger.info({ deliveryNoteId: note.id, orgId, number: docNumber, deductsStock }, 'delivery note created')
    return note
  })
}

export async function updateDeliveryNote(id: string, input: DeliveryNoteUpdateInput, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const note = await DeliveryNote.findOne({ where: { id, org_id: orgId }, transaction: t, lock: true })
    if (!note) throw new Error('DELIVERY_NOTE_NOT_FOUND')
    if (note.status !== 'draft') throw new Error('DELIVERY_NOTE_NOT_DRAFT')

    const { items, branch_id: nextBranchId, carrier_account_id, shipment_id, ...fields } = input

    const branchPatch: Record<string, unknown> = {}
    const effectiveBranchId = nextBranchId ?? note.branch_id!
    const shipment = shipment_id !== undefined
      ? await assertDeliveryNoteShipmentLink(shipment_id, fields.order_id ?? note.order_id, effectiveBranchId, orgId, t, id)
      : null
    const carrierPatch = carrier_account_id !== undefined
      ? await resolveCarrierFields(carrier_account_id, orgId, effectiveBranchId, t)
      : {}
    if (nextBranchId && nextBranchId !== note.branch_id) {
      assertDraftBranchChange(note.status)
      Object.assign(branchPatch, await buildBranchRenumberPatch({
        orgId,
        currentBranchId: note.branch_id,
        nextBranchId,
        numberField: 'delivery_number',
        resolveNextNumber: (oid, branchId, tx) => nextDeliveryNumber(oid, branchId, tx),
        t,
      }))
    }

    if (items && items.length > 0) {
      await DeliveryNoteItem.destroy({ where: { delivery_note_id: id }, transaction: t })
      await Promise.all(
        items.map((item, idx) =>
          DeliveryNoteItem.create(
            {
              delivery_note_id: id,
              org_id:           orgId,
              shipment_item_id: item.shipment_item_id ?? null,
              order_item_id:    item.order_item_id ?? null,
              product_id:       item.product_id ?? null,
              variant_id:       item.variant_id ?? null,
              description:      item.description!,
              quantity:         String(item.quantity),
              sort_order:       item.sort_order ?? idx,
              created_by:       actorId,
              updated_by:       actorId,
            },
            { transaction: t },
          ),
        ),
      )
    }

    await note.update({
      ...fields,
      ...carrierPatch,
      ...branchPatch,
      ...(shipment_id !== undefined ? { shipment_id: shipment?.id ?? null } : {}),
      ...(shipment ? { order_id: shipment.sales_order_id } : {}),
      updated_by: actorId,
    }, { transaction: t })
    return note
  })
}

export async function deleteDeliveryNote(id: string, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const note = await DeliveryNote.findOne({ where: { id, org_id: orgId }, transaction: t })
    if (!note) throw new Error('DELIVERY_NOTE_NOT_FOUND')
    if (note.status !== 'draft') throw new Error('DELIVERY_NOTE_NOT_DRAFT')

    await note.update({ deleted_by: actorId }, { transaction: t })
    await note.destroy({ transaction: t })
  })
}

/**
 * Issues a draft delivery note (draft → issued).
 * When `deducts_stock` is true, applies an `out` stock movement per stockable
 * item from the note's warehouse (reference_type `delivery_note`). When false,
 * stock was already deducted by the linked order's confirmation, so issuing
 * only records the document.
 */
export async function issueDeliveryNote(id: string, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const note = await DeliveryNote.findOne({ where: { id, org_id: orgId }, transaction: t, lock: true })
    if (!note) throw new Error('DELIVERY_NOTE_NOT_FOUND')
    if (note.status !== 'draft') throw new Error('DELIVERY_NOTE_NOT_DRAFT')

    await issueDeliveryNoteInTransaction(note, orgId, actorId, t)
    return note
  })
}

async function issueDeliveryNoteInTransaction(
  note: DeliveryNote,
  orgId: string,
  actorId: string,
  t: Transaction,
): Promise<void> {
  if (note.deducts_stock) {
    const warehouseId = note.warehouse_id ?? await resolveWarehouseForBranch(note.branch_id, orgId, t)

    const items = await DeliveryNoteItem.findAll({ where: { delivery_note_id: note.id }, transaction: t })

    const { default: ProductVariant } = await import('@/modules/catalog/product-variant.model')
    const { default: Product }        = await import('@/modules/catalog/product.model')

    for (const item of items) {
      if (!item.variant_id) continue

      const variant = await ProductVariant.findByPk(item.variant_id, { attributes: ['id', 'manage_stock'], transaction: t })
      if (!variant?.manage_stock) continue

      const product = item.product_id
        ? await Product.findByPk(item.product_id, { attributes: ['product_type'], transaction: t })
        : null
      if (product?.product_type === 'service') continue

      await applyMovement(
        {
          variantId:     item.variant_id,
          warehouseId,
          orgId,
          movementType:  'out',
          referenceType: 'delivery_note',
          referenceId:   note.id,
          quantityDelta: new Decimal(item.quantity).negated(),
          notes:         `Remito ${note.delivery_number}`,
          actorId,
        },
        t,
      )
    }
  }

  await note.update({ status: 'issued', issued_by: actorId, updated_by: actorId }, { transaction: t })
  logger.info({ deliveryNoteId: note.id, orgId, deductsStock: note.deducts_stock }, 'delivery note issued')
}

export async function createDeliveryNoteForShipment(
  shipmentId: string,
  orgId: string,
  actorId: string,
  outerTransaction?: Transaction,
) {
  ensureDeliveryNoteAssociations()

  const run = async (t: Transaction) => {
    const existing = await DeliveryNote.findOne({
      where: {
        shipment_id: shipmentId,
        org_id: orgId,
        status: { [Op.ne]: 'annulled' },
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    })
    if (existing) {
      if (existing.status === 'draft') await issueDeliveryNoteInTransaction(existing, orgId, actorId, t)
      return existing
    }

    const shipment = await loadShipmentForDeliveryNote(shipmentId, orgId, t)
    const order = await SalesOrder.findOne({
      where: { id: shipment.sales_order_id, org_id: orgId },
      attributes: ['id', 'branch_id', 'contact_id'],
      transaction: t,
      lock: t.LOCK.UPDATE,
    })
    if (!order) throw new Error('ORDER_NOT_FOUND')

    const shipmentItems = await ShipmentItem.findAll({
      where: { shipment_id: shipment.id, org_id: orgId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    })
    if (shipmentItems.length === 0) throw new Error('SHIPMENT_ITEMS_REQUIRED')

    const orderItems = await SalesOrderItem.findAll({
      where: { id: { [Op.in]: shipmentItems.map(item => item.sales_order_item_id) }, org_id: orgId },
      transaction: t,
    })
    const orderItemById = new Map(orderItems.map(item => [item.id, item]))
    const branchId = shipment.branch_id
    const docNumber = await nextDeliveryNumber(orgId, branchId, t)
    const carrierFields = await resolveCarrierFields(shipment.carrier_account_id, orgId, branchId, t)
    const deductsStock = !(await orderAlreadyDeductedStock(order.id, orgId, t))
    const note = await DeliveryNote.create(
      {
        org_id:          orgId,
        branch_id:       branchId,
        order_id:        order.id,
        contact_id:      order.contact_id,
        shipment_id:     shipment.id,
        warehouse_id:    shipment.warehouse_id,
        ...carrierFields,
        tracking_code:   shipment.tracking_number,
        ship_to_address: formatShipmentAddress(shipment),
        delivery_number: docNumber,
        issued_by:       actorId,
        status:          'draft',
        deducts_stock:   deductsStock,
        notes:           shipment.delivery_notes,
        created_by:      actorId,
        updated_by:      actorId,
      },
      { transaction: t },
    )

    await Promise.all(shipmentItems.map((item, idx) => {
      const orderItem = orderItemById.get(item.sales_order_item_id)
      return DeliveryNoteItem.create(
        {
          delivery_note_id: note.id,
          org_id:           orgId,
          shipment_item_id: item.id,
          order_item_id:    item.sales_order_item_id,
          product_id:       orderItem?.product_id ?? null,
          variant_id:       orderItem?.variant_id ?? null,
          description:      item.description,
          quantity:         String(item.quantity),
          sort_order:       idx,
          created_by:       actorId,
          updated_by:       actorId,
        },
        { transaction: t },
      )
    }))

    await issueDeliveryNoteInTransaction(note, orgId, actorId, t)
    logger.info({ deliveryNoteId: note.id, shipmentId, orgId }, 'delivery note created from shipment')
    return note
  }

  return outerTransaction ? run(outerTransaction) : sequelize.transaction(run)
}

/** Marks an issued delivery note as delivered (issued → delivered). */
export async function markDeliveryNoteDelivered(id: string, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const note = await DeliveryNote.findOne({ where: { id, org_id: orgId }, transaction: t, lock: true })
    if (!note) throw new Error('DELIVERY_NOTE_NOT_FOUND')
    if (note.status !== 'issued') throw new Error('DELIVERY_NOTE_NOT_ISSUED')

    await note.update(
      { status: 'delivered', delivery_date: note.delivery_date ?? new Date(), updated_by: actorId },
      { transaction: t },
    )
    logger.info({ deliveryNoteId: id, orgId }, 'delivery note marked delivered')
    return note
  })
}

/**
 * Annuls a delivery note (issued | delivered → annulled).
 * If the note moved stock on issue, restores it with a compensating `in`
 * movement per recorded `out` movement.
 */
export async function annulDeliveryNote(id: string, orgId: string, actorId: string) {
  return sequelize.transaction(async (t) => {
    const note = await DeliveryNote.findOne({ where: { id, org_id: orgId }, transaction: t, lock: true })
    if (!note) throw new Error('DELIVERY_NOTE_NOT_FOUND')
    if (note.status !== 'issued' && note.status !== 'delivered') throw new Error('DELIVERY_NOTE_NOT_ANNULLABLE')

    if (note.deducts_stock) {
      const movements = await StockMovement.findAll({
        where: { reference_type: 'delivery_note', reference_id: id, movement_type: 'out', org_id: orgId },
        transaction: t,
      })
      for (const mv of movements) {
        await applyMovement(
          {
            variantId:     mv.variant_id,
            warehouseId:   mv.warehouse_id,
            orgId,
            movementType:  'in',
            referenceType: 'delivery_note',
            referenceId:   id,
            quantityDelta: new Decimal(mv.quantity_delta).abs(),
            notes:         `Anulación remito ${note.delivery_number}`,
            actorId,
          },
          t,
        )
      }
    }

    await note.update({ status: 'annulled', updated_by: actorId }, { transaction: t })
    logger.info({ deliveryNoteId: id, orgId, deductsStock: note.deducts_stock }, 'delivery note annulled — stock restored if applicable')
    return note
  })
}

/**
 * Returns delivered quantity per `order_item_id` for a given sales order,
 * counting only non-annulled delivery notes. Used to pre-fill pending
 * quantities when creating a new delivery note from an order.
 */
export async function getDeliveredQtyByOrderItem(orderId: string, orgId: string): Promise<Record<string, string>> {
  const notes = await DeliveryNote.findAll({
    where: { order_id: orderId, org_id: orgId, status: { [Op.ne]: 'annulled' } },
    attributes: ['id'],
  })
  const noteIds = notes.map(n => n.id)
  if (noteIds.length === 0) return {}

  const items = await DeliveryNoteItem.findAll({
    where: { delivery_note_id: { [Op.in]: noteIds }, order_item_id: { [Op.ne]: null } },
    attributes: ['order_item_id', 'quantity'],
  })

  const acc: Record<string, Decimal> = {}
  for (const it of items) {
    const key = it.order_item_id as string
    acc[key] = (acc[key] ?? new Decimal(0)).plus(it.quantity)
  }
  return Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, v.toFixed(4)]))
}
