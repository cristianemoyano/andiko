import 'server-only'
import { Op, type Transaction } from 'sequelize'
import Decimal from 'decimal.js'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import type { TenantContext } from '@/lib/tenancy'
import { whereAllowedBranches, whereBranch } from '@/lib/tenancy'
import SalesOrder from '@/modules/sales/sales-order.model'
import SalesOrderItem from '@/modules/sales/sales-order-item.model'
import User from '@/modules/auth/user.model'
import { nextDocumentNumber } from '@/modules/sales/sales.utils'
import Shipment from './shipment.model'
import ShipmentItem from './shipment-item.model'
import ShipmentEvent from './shipment-event.model'
import CarrierAccount from './carrier-account.model'
import { assertShipmentTransition, canTransitionShipment, TERMINAL_SHIPMENT_STATUSES, resolveInHouseTrackingNumber, type ShipmentEventSource, type ShipmentStatus } from './logistics.constants'
import { resolveWarehouseForBranch } from '@/modules/inventory/branch-warehouse.resolution'
import { assertShipmentHasIssuedDeliveryNote } from '@/modules/inventory/delivery-notes.service'
import DeliveryNote from '@/modules/inventory/delivery-note.model'
import { orderAcceptsShipmentCreation } from '@/modules/sales/sales-order-workflow'
import {
  assertOrderItemIsShippable,
  loadProductTypesById,
  orderItemsToShipmentLineRefs,
} from '@/modules/sales/order-item-product-types'
import { isShippableLine } from '@/modules/sales/shippable-order-lines'
import { getFulfillmentProvider, trackingUrlFor } from './providers'
import {
  assertFullLogisticsAccess,
  assertLogisticsAssignedScope,
  whereLogisticsAssignedScope,
} from './logistics-scope'
import { resolveVehicleRef } from './vehicles.service'
import type {
  ShipmentInput, ShipmentDispatchInput, ShipmentEventInput,
  ShipmentDeliverInput, ShipmentFailInput, ShipmentAssignDriverInput, ShipmentUpdateInput, ShipmentQuery,
} from './shipment.schema'

// Estados del pedido en los que se puede generar un envío (ver orderAcceptsShipmentCreation).
const SHIPPABLE_ORDER_STATUSES = ['confirmed', 'in_progress', 'partial_returned']

export async function listShipments(query: ShipmentQuery, ctx: TenantContext) {
  const { page, limit, status, provider_kind, sales_order_id, branch_id, assigned_driver_id, search, from, to } = query
  const { offset } = paginate(page, limit)

  const where = {
    ...whereAllowedBranches(ctx),
    ...whereLogisticsAssignedScope(ctx),
    ...(branch_id ? { branch_id } : {}),
    ...(status ? { status } : {}),
    ...(provider_kind ? { provider_kind } : {}),
    ...(sales_order_id ? { sales_order_id } : {}),
    ...(assigned_driver_id ? { assigned_driver_id } : {}),
    ...(from || to
      ? { created_at: { ...(from ? { [Op.gte]: from } : {}), ...(to ? { [Op.lte]: to } : {}) } }
      : {}),
    ...(search
      ? { [Op.or]: [
          { shipment_number: { [Op.iLike]: `%${search}%` } },
          { tracking_number: { [Op.iLike]: `%${search}%` } },
          { ship_to_name: { [Op.iLike]: `%${search}%` } },
        ] }
      : {}),
  }

  const { rows, count } = await Shipment.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'DESC']],
    attributes: [
      'id', 'branch_id', 'sales_order_id', 'carrier_account_id', 'shipment_number', 'status',
      'provider_kind', 'tracking_number', 'tracking_url', 'assigned_driver_id', 'vehicle_id', 'vehicle_ref',
      'shipping_cost', 'currency', 'ship_to_name', 'ship_city', 'ship_province',
      'promised_date', 'dispatched_at', 'delivered_at', 'created_at',
    ],
    include: [
      { model: SalesOrder, as: 'salesOrder', attributes: ['id', 'order_number', 'contact_id'] },
      { model: CarrierAccount, as: 'carrierAccount', attributes: ['id', 'name', 'kind'], required: false },
      { model: User, as: 'driver', attributes: ['id', 'name'], required: false },
    ],
  })

  return toPaginated(rows.map(r => r.get({ plain: true })), count, page, limit)
}

export async function getShipment(id: string, ctx: TenantContext, t?: Transaction) {
  const shipment = await Shipment.findOne({
    where: { id, org_id: ctx.orgId },
    include: [
      { model: SalesOrder, as: 'salesOrder', attributes: ['id', 'order_number', 'status', 'contact_id'] },
      { model: CarrierAccount, as: 'carrierAccount', attributes: ['id', 'name', 'kind'], required: false },
      { model: User, as: 'driver', attributes: ['id', 'name'], required: false },
      { model: ShipmentItem, as: 'items' },
      { model: ShipmentEvent, as: 'events' },
    ],
    order: [[{ model: ShipmentEvent, as: 'events' }, 'occurred_at', 'ASC']],
    transaction: t,
  })
  if (!shipment) throw new Error('SHIPMENT_NOT_FOUND')
  if (ctx.allowedBranchIds.length > 0 && !ctx.allowedBranchIds.includes(shipment.branch_id)) {
    throw new Error('SHIPMENT_NOT_FOUND')
  }
  assertLogisticsAssignedScope(ctx, shipment)
  const deliveryNotes = await DeliveryNote.findAll({
    where: { shipment_id: id, org_id: ctx.orgId, status: { [Op.ne]: 'annulled' } },
    attributes: ['id', 'delivery_number', 'status', 'delivery_date', 'created_at'],
    order: [['created_at', 'DESC']],
    transaction: t,
  })
  return {
    ...shipment.get({ plain: true }),
    deliveryNotes: deliveryNotes.map(note => note.get({ plain: true })),
  }
}

export async function createShipmentForOrder(
  input: ShipmentInput,
  ctx: TenantContext,
  actorId: string,
  outerTransaction?: Transaction,
) {
  const run = async (t: Transaction) => {
    assertFullLogisticsAccess(ctx)
    const order = await SalesOrder.findOne({
      where: { id: input.sales_order_id, org_id: ctx.orgId },
      transaction: t,
      lock: outerTransaction ? undefined : t.LOCK.UPDATE,
    })
    if (!order) throw new Error('ORDER_NOT_FOUND')
    void whereBranch(ctx, order.branch_id as string)

    const orderItems = await SalesOrderItem.findAll({
      where: { order_id: order.id, org_id: ctx.orgId },
      transaction: t,
      lock: outerTransaction ? undefined : t.LOCK.UPDATE,
    })
    const productTypes = await loadProductTypesById(
      orderItems.map(item => item.product_id).filter((id): id is string => Boolean(id)),
      ctx.orgId,
      t,
    )
    const shipmentLineRefs = orderItemsToShipmentLineRefs(orderItems, productTypes)
    if (!orderAcceptsShipmentCreation(order.status, shipmentLineRefs)) {
      throw new Error('ORDER_NOT_SHIPPABLE')
    }

    const shippableOrderItems = orderItems.filter(item => {
      const productType = item.product_id ? productTypes.get(item.product_id) ?? null : null
      return isShippableLine({ quantity: item.quantity, shipped_qty: item.shipped_qty, product_type: productType })
    })
    const shippableById = new Map(shippableOrderItems.map(item => [item.id, item]))

    const carrier = await CarrierAccount.findOne({
      where: { id: input.carrier_account_id, org_id: ctx.orgId, is_active: true },
      transaction: t,
    })
    if (!carrier) throw new Error('CARRIER_ACCOUNT_NOT_FOUND')
    if (carrier.branch_id && carrier.branch_id !== order.branch_id) {
      throw new Error('CARRIER_ACCOUNT_BRANCH_MISMATCH')
    }
    if (carrier.kind !== 'in_house' && input.assigned_driver_id) {
      throw new Error('DRIVER_ONLY_FOR_IN_HOUSE')
    }

    const byId = new Map(orderItems.map(item => [item.id, item]))

    // Sin items explícitos: enviar todo lo pendiente físico del pedido.
    const requested = input.items
      ?? shippableOrderItems
        .map(item => ({
          sales_order_item_id: item.id,
          quantity: new Decimal(item.quantity).minus(item.shipped_qty).toNumber(),
        }))
        .filter(line => line.quantity > 0)
    if (requested.length === 0) throw new Error('ORDER_ALREADY_FULLY_SHIPPED')

    const lines = requested.map(line => {
      const orderItem = byId.get(line.sales_order_item_id)
      if (!orderItem) throw new Error('ORDER_ITEM_NOT_FOUND')
      if (!shippableById.has(line.sales_order_item_id)) throw new Error('ORDER_ITEM_NOT_SHIPPABLE')
      const qty = new Decimal(line.quantity)
      const remaining = new Decimal(orderItem.quantity).minus(orderItem.shipped_qty)
      if (qty.lte(0) || qty.gt(remaining)) throw new Error('SHIPMENT_QTY_EXCEEDS_ORDER')
      return { orderItem, qty }
    })

    const shipment_number = await nextDocumentNumber(ctx.orgId, order.branch_id as string, 'shipment', t)
    const trackingNumber = carrier.kind === 'in_house'
      ? resolveInHouseTrackingNumber(shipment_number, input.tracking_number)
      : (input.tracking_number?.trim() || null)
    const flatRate = typeof carrier.settings?.flat_rate === 'number' ? carrier.settings.flat_rate : null
    const vehicle = input.vehicle_id
      ? await resolveVehicleRef(input.vehicle_id, ctx)
      : { vehicle_id: null, vehicle_ref: input.vehicle_ref ?? null }

    let warehouseId = input.warehouse_id ?? null
    if (!warehouseId && order.branch_id) {
      try {
        warehouseId = await resolveWarehouseForBranch(order.branch_id as string, ctx.orgId, t)
      } catch {
        // Sin depósito configurado para la sucursal — el envío se crea igual.
      }
    }

    const shipment = await Shipment.create(
      {
        org_id:             ctx.orgId,
        branch_id:          order.branch_id as string,
        sales_order_id:     order.id,
        carrier_account_id: carrier.id,
        warehouse_id:       warehouseId,
        shipment_number,
        provider_kind:      carrier.kind,
        tracking_number:    trackingNumber,
        tracking_url:       trackingNumber ? trackingUrlFor(carrier.kind, trackingNumber) : null,
        assigned_driver_id: input.assigned_driver_id ?? null,
        vehicle_id:         vehicle.vehicle_id,
        vehicle_ref:        vehicle.vehicle_ref,
        shipping_cost:      String(input.shipping_cost ?? flatRate ?? 0),
        currency:           order.currency,
        ship_to_name:       input.ship_to_name ?? null,
        ship_to_phone:      input.ship_to_phone ?? null,
        ship_street:        input.ship_street ?? order.shipping_street,
        ship_number:        input.ship_number ?? order.shipping_number,
        ship_floor:         input.ship_floor ?? order.shipping_floor,
        ship_apartment:     input.ship_apartment ?? order.shipping_apartment,
        ship_city:          input.ship_city ?? order.shipping_city,
        ship_province:      input.ship_province ?? order.shipping_province,
        ship_postal_code:   input.ship_postal_code ?? order.shipping_postal_code,
        ship_country:       input.ship_country ?? order.shipping_country ?? 'Argentina',
        promised_date:      input.promised_date ?? order.promised_date,
        delivery_notes:     input.delivery_notes ?? null,
        created_by:         actorId,
        updated_by:         actorId,
      },
      { transaction: t },
    )

    await ShipmentItem.bulkCreate(
      lines.map(({ orderItem, qty }) => ({
        shipment_id:         shipment.id,
        org_id:              ctx.orgId,
        sales_order_item_id: orderItem.id,
        description:         orderItem.description,
        quantity:            qty.toFixed(4),
        created_by:          actorId,
        updated_by:          actorId,
      })),
      { transaction: t },
    )

    // Incremento atómico: junto al CHECK shipped_qty <= quantity evita
    // sobre-envíos ante creaciones concurrentes.
    for (const { orderItem, qty } of lines) {
      await orderItem.increment('shipped_qty', { by: qty.toNumber(), transaction: t })
    }

    await ShipmentEvent.create(
      {
        shipment_id: shipment.id,
        org_id:      ctx.orgId,
        status:      'pending',
        description: 'Envío creado',
        source:      'system',
        created_by:  actorId,
      },
      { transaction: t },
    )

    logger.info(
      { shipmentId: shipment.id, shipment_number, orderId: order.id, kind: carrier.kind, orgId: ctx.orgId, actorId },
      'shipment created',
    )
    return getShipment(shipment.id, ctx, t)
  }

  return outerTransaction ? run(outerTransaction) : sequelize.transaction(run)
}

export async function dispatchShipment(id: string, input: ShipmentDispatchInput, ctx: TenantContext, actorId: string) {
  return sequelize.transaction(async (t) => {
    const shipment = await loadShipmentForUpdate(id, ctx, t)
    assertShipmentTransition(shipment.status, 'dispatched')
    await assertShipmentHasIssuedDeliveryNote(shipment.id, ctx.orgId, t)

    if (shipment.provider_kind !== 'in_house' && input.assigned_driver_id) {
      throw new Error('DRIVER_ONLY_FOR_IN_HOUSE')
    }

    const vehicle = input.vehicle_id !== undefined
      ? await resolveVehicleRef(input.vehicle_id, ctx)
      : null

    const items = await ShipmentItem.findAll({ where: { shipment_id: shipment.id }, transaction: t })
    const provider = getFulfillmentProvider(shipment.provider_kind)
    const result = await provider.dispatch({
      shipmentNumber: shipment.shipment_number,
      trackingNumber: input.tracking_number ?? shipment.tracking_number,
      destination: {
        name:        shipment.ship_to_name,
        phone:       shipment.ship_to_phone,
        street:      shipment.ship_street,
        number:      shipment.ship_number,
        floor:       shipment.ship_floor,
        apartment:   shipment.ship_apartment,
        city:        shipment.ship_city,
        province:    shipment.ship_province,
        postal_code: shipment.ship_postal_code,
        country:     shipment.ship_country,
      },
      items: items.map(item => ({ description: item.description, quantity: item.quantity })),
      notes: shipment.delivery_notes,
    })

    await shipment.update(
      {
        status:             'dispatched',
        dispatched_at:      new Date(),
        tracking_number:    input.tracking_number ?? result.trackingNumber ?? shipment.tracking_number,
        tracking_url:       result.trackingUrl ?? shipment.tracking_url,
        label_url:          result.labelUrl ?? shipment.label_url,
        shipping_cost:      input.shipping_cost !== undefined
          ? String(input.shipping_cost)
          : (result.cost ?? shipment.shipping_cost),
        assigned_driver_id: input.assigned_driver_id ?? shipment.assigned_driver_id,
        vehicle_id:         input.vehicle_id !== undefined ? vehicle?.vehicle_id ?? null : shipment.vehicle_id,
        vehicle_ref:        input.vehicle_id !== undefined
          ? vehicle?.vehicle_ref ?? input.vehicle_ref ?? null
          : (input.vehicle_ref ?? shipment.vehicle_ref),
        updated_by:         actorId,
      },
      { transaction: t },
    )

    await ShipmentEvent.create(
      {
        shipment_id: shipment.id,
        org_id:      ctx.orgId,
        status:      'dispatched',
        description: 'Envío despachado',
        source:      'system',
        created_by:  actorId,
      },
      { transaction: t },
    )

    logger.info({ shipmentId: id, kind: shipment.provider_kind, orgId: ctx.orgId, actorId }, 'shipment dispatched')
    return getShipment(id, ctx, t)
  })
}

export async function recordShipmentEvent(
  id: string,
  input: ShipmentEventInput,
  ctx: TenantContext,
  actorId: string,
  source: ShipmentEventSource = 'manual',
) {
  return sequelize.transaction(async (t) => {
    const shipment = await loadShipmentForUpdate(id, ctx, t)
    const occurredAt = input.occurred_at ?? new Date()
    const advances = input.status !== shipment.status

    if (advances) {
      assertShipmentTransition(shipment.status, input.status)
      await shipment.update(
        {
          status: input.status,
          ...(input.status === 'delivered' ? { delivered_at: occurredAt } : {}),
          ...(input.status === 'failed' ? { failure_reason: input.description ?? null } : {}),
          updated_by: actorId,
        },
        { transaction: t },
      )
      if (input.status === 'returned') {
        await restoreShippedQty(shipment.id, t)
      }
    }

    await ShipmentEvent.create(
      {
        shipment_id: shipment.id,
        org_id:      ctx.orgId,
        status:      input.status,
        description: input.description ?? null,
        occurred_at: occurredAt,
        source,
        created_by:  actorId,
      },
      { transaction: t },
    )

    if (advances && input.status === 'delivered') {
      await syncOrderDeliveredState(shipment.sales_order_id, occurredAt, actorId, t)
    }

    logger.info(
      { shipmentId: id, status: input.status, source, orgId: ctx.orgId, actorId },
      'shipment event recorded',
    )
    return getShipment(id, ctx, t)
  })
}

export async function markShipmentDelivered(id: string, input: ShipmentDeliverInput, ctx: TenantContext, actorId: string) {
  return recordShipmentEvent(
    id,
    { status: 'delivered', description: input.description ?? 'Entregado', occurred_at: input.delivered_at },
    ctx,
    actorId,
  )
}

export async function markShipmentFailed(id: string, input: ShipmentFailInput, ctx: TenantContext, actorId: string) {
  return recordShipmentEvent(id, { status: 'failed', description: input.reason }, ctx, actorId)
}

export async function cancelShipment(id: string, ctx: TenantContext, actorId: string, reason?: string) {
  return sequelize.transaction(async (t) => {
    const shipment = await loadShipmentForUpdate(id, ctx, t)
    assertShipmentTransition(shipment.status, 'cancelled')

    const provider = getFulfillmentProvider(shipment.provider_kind)
    await provider.cancel(shipment.tracking_number)

    await shipment.update({ status: 'cancelled', updated_by: actorId }, { transaction: t })
    await restoreShippedQty(shipment.id, t)

    await ShipmentEvent.create(
      {
        shipment_id: shipment.id,
        org_id:      ctx.orgId,
        status:      'cancelled',
        description: reason ?? 'Envío cancelado',
        source:      'manual',
        created_by:  actorId,
      },
      { transaction: t },
    )

    logger.info({ shipmentId: id, reason, orgId: ctx.orgId, actorId }, 'shipment cancelled')
    return getShipment(id, ctx, t)
  })
}

export async function updateShipment(id: string, input: ShipmentUpdateInput, ctx: TenantContext, actorId: string) {
  return sequelize.transaction(async (t) => {
    const shipment = await loadShipmentForUpdate(id, ctx, t)
    assertFullLogisticsAccess(ctx)

    if (TERMINAL_SHIPMENT_STATUSES.includes(shipment.status)) {
      throw new Error('SHIPMENT_ALREADY_CLOSED')
    }

    const updates: Record<string, unknown> = { updated_by: actorId }

    if (input.ship_to_name !== undefined)     updates.ship_to_name = input.ship_to_name
    if (input.ship_to_phone !== undefined)    updates.ship_to_phone = input.ship_to_phone
    if (input.ship_street !== undefined)      updates.ship_street = input.ship_street
    if (input.ship_number !== undefined)      updates.ship_number = input.ship_number
    if (input.ship_floor !== undefined)       updates.ship_floor = input.ship_floor
    if (input.ship_apartment !== undefined)   updates.ship_apartment = input.ship_apartment
    if (input.ship_city !== undefined)        updates.ship_city = input.ship_city
    if (input.ship_province !== undefined)    updates.ship_province = input.ship_province
    if (input.ship_postal_code !== undefined) updates.ship_postal_code = input.ship_postal_code
    if (input.ship_country !== undefined)     updates.ship_country = input.ship_country
    if (input.promised_date !== undefined)    updates.promised_date = input.promised_date
    if (input.delivery_notes !== undefined)   updates.delivery_notes = input.delivery_notes
    if (input.shipping_cost !== undefined)    updates.shipping_cost = String(input.shipping_cost)

    if (input.tracking_number !== undefined) {
      const tracking = shipment.provider_kind === 'in_house'
        ? resolveInHouseTrackingNumber(shipment.shipment_number, input.tracking_number)
        : (input.tracking_number?.trim() || null)
      updates.tracking_number = tracking
      updates.tracking_url = tracking ? trackingUrlFor(shipment.provider_kind, tracking) : null
    }

    const touchesDriver = input.assigned_driver_id !== undefined
      || input.vehicle_id !== undefined
      || input.vehicle_ref !== undefined
    if (touchesDriver) {
      if (shipment.provider_kind !== 'in_house') throw new Error('DRIVER_ONLY_FOR_IN_HOUSE')
      if (input.assigned_driver_id !== undefined) updates.assigned_driver_id = input.assigned_driver_id
      if (input.vehicle_id !== undefined) {
        const vehicle = input.vehicle_id
          ? await resolveVehicleRef(input.vehicle_id, ctx)
          : { vehicle_id: null, vehicle_ref: input.vehicle_ref ?? null }
        updates.vehicle_id = vehicle.vehicle_id
        updates.vehicle_ref = vehicle.vehicle_ref
      } else if (input.vehicle_ref !== undefined) {
        updates.vehicle_ref = input.vehicle_ref
      }
    }

    let itemsTouched = false
    if (input.items !== undefined) {
      await updateShipmentItems(shipment, input.items, ctx, actorId, t)
      itemsTouched = true
    }

    const hasFieldUpdates = Object.keys(updates).length > 1
    if (!hasFieldUpdates && !itemsTouched) {
      return getShipment(id, ctx, t)
    }

    if (hasFieldUpdates) {
      await shipment.update(updates as Parameters<typeof shipment.update>[0], { transaction: t })
    }
    logger.info({ shipmentId: id, orgId: ctx.orgId, actorId }, 'shipment updated')
    return getShipment(id, ctx, t)
  })
}

export async function assignShipmentDriver(id: string, input: ShipmentAssignDriverInput, ctx: TenantContext, actorId: string) {
  return updateShipment(id, {
    assigned_driver_id: input.assigned_driver_id,
    vehicle_id: input.vehicle_id,
    vehicle_ref: input.vehicle_ref,
  }, ctx, actorId)
}

/**
 * Usuarios activos de la organización asignables como repartidor en reparto propio.
 * En PYMEs suele ser cualquier empleado, no solo el rol «Repartidor».
 */
export async function listDrivers(ctx: TenantContext) {
  assertFullLogisticsAccess(ctx)

  const rows = await User.findAll({
    where: {
      org_id: ctx.orgId,
      is_active: true,
      role: { [Op.ne]: 'sys-admin' },
    },
    attributes: ['id', 'name'],
    order: [['name', 'ASC']],
    limit: 200,
  })
  return rows.map(r => r.get({ plain: true }))
}

/** Estados del envío alcanzables desde el estado actual (para la UI). */
export function nextShipmentStatuses(current: ShipmentStatus): ShipmentStatus[] {
  return (['ready_to_ship', 'dispatched', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned', 'cancelled'] as const)
    .filter(status => canTransitionShipment(current, status))
}

async function loadShipmentForUpdate(id: string, ctx: TenantContext, t: Transaction) {
  const shipment = await Shipment.findOne({
    where: { id, org_id: ctx.orgId },
    transaction: t,
    lock: t.LOCK.UPDATE,
  })
  if (!shipment) throw new Error('SHIPMENT_NOT_FOUND')
  void whereBranch(ctx, shipment.branch_id)
  assertLogisticsAssignedScope(ctx, shipment)
  return shipment
}

type ShipmentItemUpdateLine = { sales_order_item_id: string; quantity: number }

async function updateShipmentItems(
  shipment: Shipment,
  inputItems: ShipmentItemUpdateLine[],
  ctx: TenantContext,
  actorId: string,
  t: Transaction,
) {
  const positiveLines = inputItems.filter(line => line.quantity > 0)
  if (positiveLines.length === 0) throw new Error('SHIPMENT_ITEMS_REQUIRED')

  const currentItems = await ShipmentItem.findAll({
    where: { shipment_id: shipment.id },
    transaction: t,
    lock: t.LOCK.UPDATE,
  })
  const currentByOrderItemId = new Map(currentItems.map(item => [item.sales_order_item_id, item]))

  const orderItems = await SalesOrderItem.findAll({
    where: { order_id: shipment.sales_order_id, org_id: ctx.orgId },
    transaction: t,
    lock: t.LOCK.UPDATE,
  })
  const orderById = new Map(orderItems.map(item => [item.id, item]))
  const productTypes = await loadProductTypesById(
    orderItems.map(item => item.product_id).filter((id): id is string => Boolean(id)),
    ctx.orgId,
    t,
  )

  const mentionedOrderItemIds = new Set<string>()
  const seen = new Set<string>()

  for (const line of inputItems) {
    if (seen.has(line.sales_order_item_id)) continue
    seen.add(line.sales_order_item_id)
    mentionedOrderItemIds.add(line.sales_order_item_id)
    const orderItem = orderById.get(line.sales_order_item_id)
    if (!orderItem) throw new Error('ORDER_ITEM_NOT_FOUND')
    assertOrderItemIsShippable(orderItem, productTypes)

    const current = currentByOrderItemId.get(line.sales_order_item_id)
    const currentQty = current ? new Decimal(current.quantity) : new Decimal(0)
    const newQty = new Decimal(line.quantity)

    const maxAllowed = new Decimal(orderItem.quantity)
      .minus(orderItem.shipped_qty)
      .plus(currentQty)
    if (newQty.gt(maxAllowed)) throw new Error('SHIPMENT_QTY_EXCEEDS_ORDER')

    const delta = newQty.minus(currentQty)
    if (delta.isZero()) continue

    if (newQty.isZero()) {
      if (current) {
        await current.destroy({ transaction: t })
        await orderItem.decrement('shipped_qty', { by: currentQty.toNumber(), transaction: t })
      }
      continue
    }

    if (current) {
      await current.update(
        { quantity: newQty.toFixed(4), updated_by: actorId },
        { transaction: t },
      )
      if (delta.gt(0)) {
        await orderItem.increment('shipped_qty', { by: delta.toNumber(), transaction: t })
      } else {
        await orderItem.decrement('shipped_qty', { by: delta.abs().toNumber(), transaction: t })
      }
      continue
    }

    await ShipmentItem.create(
      {
        shipment_id:         shipment.id,
        org_id:              ctx.orgId,
        sales_order_item_id: orderItem.id,
        description:         orderItem.description,
        quantity:            newQty.toFixed(4),
        created_by:          actorId,
        updated_by:          actorId,
      },
      { transaction: t },
    )
    await orderItem.increment('shipped_qty', { by: newQty.toNumber(), transaction: t })
  }

  for (const current of currentItems) {
    if (mentionedOrderItemIds.has(current.sales_order_item_id)) continue
    const qty = new Decimal(current.quantity)
    await current.destroy({ transaction: t })
    await SalesOrderItem.decrement('shipped_qty', {
      by: qty.toNumber(),
      where: { id: current.sales_order_item_id },
      transaction: t,
    })
  }
}

/** Devuelve al pedido las cantidades de un envío cancelado/devuelto para poder re-enviarlas. */
async function restoreShippedQty(shipmentId: string, t: Transaction) {
  const items = await ShipmentItem.findAll({ where: { shipment_id: shipmentId }, transaction: t })
  for (const item of items) {
    await SalesOrderItem.decrement('shipped_qty', {
      by: new Decimal(item.quantity).toNumber(),
      where: { id: item.sales_order_item_id },
      transaction: t,
    })
  }
}

/**
 * Cierra envíos abiertos cuando el usuario elige sincronizar logística al marcar entregado.
 * No crea envíos implícitos — retiro en sucursal queda sin registro de envío.
 */
export async function closeOpenShipmentsWhenOrderDelivered(
  orderId: string,
  orgId: string,
  actorId: string,
  deliveredAt: Date,
  t: Transaction,
): Promise<void> {
  const order = await SalesOrder.findOne({
    where: { id: orderId, org_id: orgId },
    transaction: t,
    lock: t.LOCK.UPDATE,
  })
  if (!order?.branch_id) return

  const orderItems = await SalesOrderItem.findAll({
    where: { order_id: orderId, org_id: orgId },
    transaction: t,
    lock: t.LOCK.UPDATE,
  })
  const productTypes = await loadProductTypesById(
    orderItems.map(item => item.product_id).filter((id): id is string => Boolean(id)),
    orgId,
    t,
  )

  for (const item of orderItems) {
    const productType = item.product_id ? productTypes.get(item.product_id) ?? null : null
    if (!isShippableLine({ quantity: item.quantity, shipped_qty: item.shipped_qty, product_type: productType })) {
      continue
    }
    const remaining = new Decimal(item.quantity).minus(item.shipped_qty)
    if (remaining.gt(0)) {
      await item.increment('shipped_qty', { by: remaining.toNumber(), transaction: t })
    }
  }

  const activeShipments = await Shipment.findAll({
    where: {
      sales_order_id: orderId,
      org_id: orgId,
      status: { [Op.notIn]: ['cancelled', 'returned'] },
    },
    transaction: t,
    lock: t.LOCK.UPDATE,
  })

  if (activeShipments.length === 0) return

  for (const shipment of activeShipments) {
    if (shipment.status === 'delivered') continue
    await shipment.update(
      { status: 'delivered', delivered_at: deliveredAt, updated_by: actorId },
      { transaction: t },
    )
    await ShipmentEvent.create(
      {
        shipment_id: shipment.id,
        org_id:      orgId,
        status:      'delivered',
        description: 'Entregado al marcar el pedido como entregado',
        occurred_at: deliveredAt,
        source:      'system',
        created_by:  actorId,
      },
      { transaction: t },
    )
  }
  logger.info({ orderId, shipmentCount: activeShipments.length }, 'shipments closed from order delivered')
}

/** @deprecated Use closeOpenShipmentsWhenOrderDelivered — kept for imports during transition. */
export const syncShipmentsWhenOrderDelivered = closeOpenShipmentsWhenOrderDelivered

/**
 * Con todas las líneas enviadas y todos los envíos activos entregados,
 * el pedido pasa a `delivered`.
 */
async function syncOrderDeliveredState(orderId: string, deliveredAt: Date, actorId: string, t: Transaction) {
  const order = await SalesOrder.findOne({
    where: { id: orderId },
    transaction: t,
    lock: t.LOCK.UPDATE,
  })
  if (!order || !SHIPPABLE_ORDER_STATUSES.includes(order.status)) return

  const items = await SalesOrderItem.findAll({
    where: { order_id: orderId },
    transaction: t,
  })
  const productTypes = await loadProductTypesById(
    items.map(item => item.product_id).filter((id): id is string => Boolean(id)),
    order.org_id as string,
    t,
  )
  const shippableItems = items.filter(item => {
    const productType = item.product_id ? productTypes.get(item.product_id) ?? null : null
    return isShippableLine({ quantity: item.quantity, shipped_qty: item.shipped_qty, product_type: productType })
  })
  const fullyShipped = shippableItems.length === 0 || shippableItems.every(
    item => new Decimal(item.shipped_qty).gte(item.quantity),
  )
  if (!fullyShipped) return

  const openShipments = await Shipment.count({
    where: {
      sales_order_id: orderId,
      status: { [Op.notIn]: ['delivered', 'cancelled', 'returned'] },
    },
    transaction: t,
  })
  if (openShipments > 0) return

  await order.update(
    { status: 'delivered', delivered_date: deliveredAt, updated_by: actorId },
    { transaction: t },
  )
  logger.info({ orderId, deliveredAt }, 'order marked delivered from shipments')
}
