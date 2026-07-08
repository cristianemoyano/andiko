import 'server-only'
import { Op, fn, col, type Transaction } from 'sequelize'
import Decimal from 'decimal.js'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import type { TenantContext } from '@/lib/tenancy'
import { whereAllowedBranches, whereBranch } from '@/lib/tenancy'
import { nextDocumentNumber } from '@/modules/sales/sales.utils'
import { assertShipmentHasIssuedDeliveryNote } from '@/modules/inventory/delivery-notes.service'
import SalesOrder from '@/modules/sales/sales-order.model'
import SalesOrderItem from '@/modules/sales/sales-order-item.model'
import User from '@/modules/auth/user.model'
import Shipment from './shipment.model'
import ShipmentItem from './shipment-item.model'
import ShipmentEvent from './shipment-event.model'
import CarrierAccount from './carrier-account.model'
import DeliveryRun from './delivery-run.model'
import DeliveryStop from './delivery-stop.model'
import DeliveryRunShipment from './delivery-run-shipment.model'
import {
  assertDeliveryRunTransition,
  assertShipmentTransition,
  DELIVERY_STOP_STATUS_LABEL,
  TERMINAL_DELIVERY_RUN_STATUSES,
  TERMINAL_SHIPMENT_STATUSES,
  type DeliveryRunStatus,
  type FulfillmentKind,
  type ShipmentStatus,
} from './logistics.constants'
import {
  assertFullLogisticsAccess,
  assertLogisticsAssignedScope,
  whereLogisticsAssignedScope,
} from './logistics-scope'
import { getFulfillmentProvider, trackingUrlFor } from './providers'
import { resolveVehicleRef } from './vehicles.service'
import { isShippableLine } from '@/modules/sales/shippable-order-lines'
import { loadProductTypesById } from '@/modules/sales/order-item-product-types'
import type {
  DeliveryRunInput,
  DeliveryRunUpdateInput,
  DeliveryRunAddShipmentsInput,
  DeliveryRunDispatchInput,
  DeliveryStopDeliverInput,
  DeliveryRunQuery,
  EligibleShipmentQuery,
} from './delivery-run.schema'

const SHIPPABLE_ORDER_STATUSES = ['confirmed', 'in_progress', 'partial_returned']
const RUN_EDITABLE_STATUSES: readonly DeliveryRunStatus[] = ['draft', 'planned']
const RUN_LIST_ATTRIBUTES = [
  'id', 'branch_id', 'run_number', 'status', 'planned_date', 'assigned_driver_id',
  'vehicle_id', 'vehicle_ref', 'carrier_account_id', 'provider_kind',
  'dispatched_at', 'completed_at', 'notes', 'created_at', 'updated_at',
] as const
const SHIPMENT_LIST_ATTRIBUTES = [
  'id', 'branch_id', 'sales_order_id', 'carrier_account_id', 'shipment_number', 'status',
  'provider_kind', 'tracking_number', 'tracking_url', 'assigned_driver_id', 'vehicle_id', 'vehicle_ref',
  'ship_to_name', 'ship_to_phone', 'ship_street', 'ship_number', 'ship_floor', 'ship_apartment',
  'ship_city', 'ship_province', 'ship_postal_code', 'ship_country', 'promised_date',
  'dispatched_at', 'delivered_at', 'delivery_result_reason', 'delivery_result_notes', 'created_at',
] as const

type CountRow = { delivery_run_id: string; shipment_count: string | number }
type ShipmentWithOrder = Shipment & { salesOrder?: SalesOrder | null }
type RunDetailLink = DeliveryRunShipment & { shipment?: ShipmentWithOrder | null }

export async function listDeliveryRuns(query: DeliveryRunQuery, ctx: TenantContext) {
  const { page, limit, branch_id, status, assigned_driver_id, planned_from, planned_to, search } = query
  const { offset } = paginate(page, limit)

  const where = {
    ...whereAllowedBranches(ctx),
    ...whereLogisticsAssignedScope(ctx),
    ...(branch_id ? { branch_id } : {}),
    ...(status ? { status } : {}),
    ...(assigned_driver_id ? { assigned_driver_id } : {}),
    ...(planned_from || planned_to
      ? { planned_date: { ...(planned_from ? { [Op.gte]: planned_from } : {}), ...(planned_to ? { [Op.lte]: planned_to } : {}) } }
      : {}),
    ...(search ? { run_number: { [Op.iLike]: `%${search}%` } } : {}),
  }

  const { rows, count } = await DeliveryRun.findAndCountAll({
    where,
    limit,
    offset,
    order: [['planned_date', 'DESC'], ['created_at', 'DESC']],
    attributes: [...RUN_LIST_ATTRIBUTES],
    include: [
      { model: User, as: 'driver', attributes: ['id', 'name'], required: false },
      { model: CarrierAccount, as: 'carrierAccount', attributes: ['id', 'name', 'kind'], required: false },
    ],
  })

  const runIds = rows.map(row => row.id)
  const shipmentCounts = await countShipmentsByRun(runIds)
  return toPaginated(
    rows.map(row => ({
      ...row.get({ plain: true }),
      shipment_count: shipmentCounts.get(row.id) ?? 0,
    })),
    count,
    page,
    limit,
  )
}

export async function listEligibleRunShipments(query: EligibleShipmentQuery, ctx: TenantContext) {
  assertFullLogisticsAccess(ctx)
  const { page, limit, branch_id, status, provider_kind, assigned_driver_id, promised_from, promised_to, postal_code, search } = query
  const { offset } = paginate(page, limit)
  const assignedShipmentIds = await DeliveryRunShipment.findAll({
    where: { org_id: ctx.orgId },
    attributes: ['shipment_id'],
  })

  const where = {
    ...whereAllowedBranches(ctx),
    status: status ?? { [Op.in]: ['pending', 'ready_to_ship'] },
    ...(provider_kind ? { provider_kind } : {}),
    ...(branch_id ? { branch_id } : {}),
    ...(assigned_driver_id ? { assigned_driver_id } : {}),
    ...(postal_code ? { ship_postal_code: postal_code } : {}),
    ...(promised_from || promised_to
      ? { promised_date: { ...(promised_from ? { [Op.gte]: promised_from } : {}), ...(promised_to ? { [Op.lte]: promised_to } : {}) } }
      : {}),
    ...(assignedShipmentIds.length > 0 ? { id: { [Op.notIn]: assignedShipmentIds.map(link => link.shipment_id) } } : {}),
    ...(search
      ? { [Op.or]: [
          { shipment_number: { [Op.iLike]: `%${search}%` } },
          { ship_to_name: { [Op.iLike]: `%${search}%` } },
          { ship_city: { [Op.iLike]: `%${search}%` } },
          { ship_postal_code: { [Op.iLike]: `%${search}%` } },
        ] }
      : {}),
  }

  const { rows, count } = await Shipment.findAndCountAll({
    where,
    limit,
    offset,
    order: [['promised_date', 'ASC'], ['created_at', 'ASC']],
    attributes: [...SHIPMENT_LIST_ATTRIBUTES],
    include: [
      { model: SalesOrder, as: 'salesOrder', attributes: ['id', 'order_number', 'status', 'contact_id'] },
      { model: CarrierAccount, as: 'carrierAccount', attributes: ['id', 'name', 'kind'], required: false },
      { model: User, as: 'driver', attributes: ['id', 'name'], required: false },
    ],
  })

  return toPaginated(rows.map(row => row.get({ plain: true })), count, page, limit)
}

export async function getDeliveryRun(id: string, ctx: TenantContext, t?: Transaction) {
  const run = await DeliveryRun.findOne({
    where: { id, org_id: ctx.orgId },
    attributes: [...RUN_LIST_ATTRIBUTES],
    include: [
      { model: User, as: 'driver', attributes: ['id', 'name'], required: false },
      { model: CarrierAccount, as: 'carrierAccount', attributes: ['id', 'name', 'kind'], required: false },
    ],
    transaction: t,
  })
  if (!run) throw new Error('DELIVERY_RUN_NOT_FOUND')
  void whereBranch(ctx, run.branch_id)
  assertLogisticsAssignedScope(ctx, run, 'DELIVERY_RUN_NOT_FOUND')

  const stops = await DeliveryStop.findAll({
    where: { delivery_run_id: run.id, org_id: ctx.orgId },
    order: [['sequence', 'ASC']],
    transaction: t,
  })
  const links = await DeliveryRunShipment.findAll({
    where: { delivery_run_id: run.id, org_id: ctx.orgId },
    include: [
      {
        model: Shipment,
        as: 'shipment',
        attributes: [...SHIPMENT_LIST_ATTRIBUTES],
        include: [
          { model: SalesOrder, as: 'salesOrder', attributes: ['id', 'order_number', 'status', 'contact_id'] },
          { model: CarrierAccount, as: 'carrierAccount', attributes: ['id', 'name', 'kind'], required: false },
          { model: User, as: 'driver', attributes: ['id', 'name'], required: false },
          { model: ShipmentItem, as: 'items', attributes: ['id', 'sales_order_item_id', 'description', 'quantity'], required: false },
        ],
      },
    ],
    transaction: t,
  })

  const shipmentsByStopId = new Map<string, unknown[]>()
  for (const link of links as RunDetailLink[]) {
    if (!link.shipment) continue
    const bucket = shipmentsByStopId.get(link.delivery_stop_id) ?? []
    bucket.push(link.shipment.get({ plain: true }))
    shipmentsByStopId.set(link.delivery_stop_id, bucket)
  }

  return {
    ...run.get({ plain: true }),
    shipment_count: links.length,
    stops: stops.map(stop => ({
      ...stop.get({ plain: true }),
      shipments: shipmentsByStopId.get(stop.id) ?? [],
    })),
  }
}

export async function createDeliveryRun(
  input: DeliveryRunInput,
  ctx: TenantContext,
  actorId: string,
  outerTransaction?: Transaction,
) {
  const run = async (t: Transaction) => {
    assertFullLogisticsAccess(ctx)
    const shipments = await loadEligibleShipments(input.shipment_ids, ctx, t)
    const branchId = input.branch_id ?? shipments[0].branch_id
    validateShipmentsForRun(shipments, branchId)
    void whereBranch(ctx, branchId)

    const providerKind = input.provider_kind ?? shipments[0].provider_kind
    const carrierAccountId = input.carrier_account_id ?? shipments[0].carrier_account_id
    await validateRunProvider(providerKind, carrierAccountId, branchId, ctx, t)
    validateShipmentProviderConsistency(shipments, providerKind, carrierAccountId)
    const vehicle = await resolveRunVehicle(providerKind, input, ctx)
    const runNumber = await nextDocumentNumber(ctx.orgId, branchId, 'delivery_run', t)

    const run = await DeliveryRun.create(
      {
        org_id:             ctx.orgId,
        branch_id:          branchId,
        run_number:         runNumber,
        status:             'planned',
        planned_date:       input.planned_date ?? new Date(),
        assigned_driver_id: input.assigned_driver_id ?? null,
        vehicle_id:         vehicle.vehicle_id,
        vehicle_ref:        vehicle.vehicle_ref,
        carrier_account_id: carrierAccountId,
        provider_kind:      providerKind,
        notes:              input.notes ?? null,
        created_by:         actorId,
        updated_by:         actorId,
      },
      { transaction: t },
    )

    await attachShipmentsToRun(run, shipments, ctx, actorId, t)
    logger.info({ deliveryRunId: run.id, runNumber, shipmentCount: shipments.length, orgId: ctx.orgId, actorId }, 'delivery run created')
    return getDeliveryRun(run.id, ctx, t)
  }

  return outerTransaction ? run(outerTransaction) : sequelize.transaction(run)
}

export async function updateDeliveryRun(id: string, input: DeliveryRunUpdateInput, ctx: TenantContext, actorId: string) {
  return sequelize.transaction(async (t) => {
    assertFullLogisticsAccess(ctx)
    const run = await loadRunForUpdate(id, ctx, t)
    assertRunEditable(run)

    const providerKind = input.provider_kind ?? run.provider_kind
    const carrierAccountId = input.carrier_account_id !== undefined ? input.carrier_account_id : run.carrier_account_id
    await validateRunProvider(providerKind, carrierAccountId, run.branch_id, ctx, t)
    await validateExistingRunShipmentProvider(run, providerKind, carrierAccountId, t)
    const vehicle = await resolveRunVehicle(providerKind, input, ctx)

    await run.update(
      {
        ...(input.planned_date !== undefined ? { planned_date: input.planned_date } : {}),
        ...(input.assigned_driver_id !== undefined ? { assigned_driver_id: input.assigned_driver_id } : {}),
        ...(input.vehicle_id !== undefined || input.vehicle_ref !== undefined
          ? { vehicle_id: vehicle.vehicle_id, vehicle_ref: vehicle.vehicle_ref }
          : {}),
        ...(input.carrier_account_id !== undefined ? { carrier_account_id: input.carrier_account_id } : {}),
        ...(input.provider_kind !== undefined ? { provider_kind: input.provider_kind } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        updated_by: actorId,
      },
      { transaction: t },
    )

    logger.info({ deliveryRunId: id, orgId: ctx.orgId, actorId }, 'delivery run updated')
    return getDeliveryRun(id, ctx, t)
  })
}

export async function addShipmentsToRun(id: string, input: DeliveryRunAddShipmentsInput, ctx: TenantContext, actorId: string) {
  return sequelize.transaction(async (t) => {
    assertFullLogisticsAccess(ctx)
    const run = await loadRunForUpdate(id, ctx, t)
    assertRunEditable(run)
    const shipments = await loadEligibleShipments(input.shipment_ids, ctx, t)
    validateShipmentsForRun(shipments, run.branch_id)
    validateShipmentProviderConsistency(shipments, run.provider_kind, run.carrier_account_id)
    await attachShipmentsToRun(run, shipments, ctx, actorId, t)
    logger.info({ deliveryRunId: id, shipmentCount: shipments.length, orgId: ctx.orgId, actorId }, 'shipments added to delivery run')
    return getDeliveryRun(id, ctx, t)
  })
}

export async function removeShipmentFromRun(id: string, shipmentId: string, ctx: TenantContext, actorId: string) {
  return sequelize.transaction(async (t) => {
    assertFullLogisticsAccess(ctx)
    const run = await loadRunForUpdate(id, ctx, t)
    assertRunEditable(run)
    const link = await DeliveryRunShipment.findOne({
      where: { delivery_run_id: id, shipment_id: shipmentId, org_id: ctx.orgId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    })
    if (!link) throw new Error('DELIVERY_RUN_SHIPMENT_NOT_FOUND')
    const stopId = link.delivery_stop_id
    await link.update({ deleted_by: actorId }, { transaction: t })
    await link.destroy({ transaction: t })

    const remainingStopLinks = await DeliveryRunShipment.count({
      where: { delivery_stop_id: stopId, org_id: ctx.orgId },
      transaction: t,
    })
    if (remainingStopLinks === 0) {
      const stop = await DeliveryStop.findOne({ where: { id: stopId, org_id: ctx.orgId }, transaction: t })
      if (stop) {
        await stop.update({ deleted_by: actorId }, { transaction: t })
        await stop.destroy({ transaction: t })
      }
    }

    logger.info({ deliveryRunId: id, shipmentId, orgId: ctx.orgId, actorId }, 'shipment removed from delivery run')
    return getDeliveryRun(id, ctx, t)
  })
}

export async function dispatchDeliveryRun(id: string, input: DeliveryRunDispatchInput, ctx: TenantContext, actorId: string) {
  return sequelize.transaction(async (t) => {
    assertFullLogisticsAccess(ctx)
    const run = await loadRunForUpdate(id, ctx, t)
    assertDeliveryRunTransition(run.status, 'dispatched')
    const links = await loadRunLinksWithShipments(id, ctx, t)
    if (links.length === 0) throw new Error('DELIVERY_RUN_SHIPMENTS_REQUIRED')

    const vehicle = input.vehicle_id !== undefined
      ? await resolveRunVehicle(run.provider_kind, input, ctx)
      : { vehicle_id: run.vehicle_id, vehicle_ref: input.vehicle_ref ?? run.vehicle_ref }
    const assignedDriverId = input.assigned_driver_id !== undefined ? input.assigned_driver_id : run.assigned_driver_id
    if (run.provider_kind !== 'in_house' && assignedDriverId) throw new Error('DRIVER_ONLY_FOR_IN_HOUSE')
    const dispatchedAt = new Date()

    for (const link of links) {
      if (!link.shipment) continue
      await dispatchShipmentInRun(link.shipment, {
        assignedDriverId,
        vehicleId: vehicle.vehicle_id,
        vehicleRef: vehicle.vehicle_ref,
        dispatchedAt,
      }, ctx, actorId, t)
    }

    await run.update(
      {
        status:             'dispatched',
        dispatched_at:      dispatchedAt,
        assigned_driver_id: assignedDriverId ?? null,
        vehicle_id:         vehicle.vehicle_id,
        vehicle_ref:        vehicle.vehicle_ref,
        updated_by:         actorId,
      },
      { transaction: t },
    )
    logger.info({ deliveryRunId: id, shipmentCount: links.length, orgId: ctx.orgId, actorId }, 'delivery run dispatched')
    return getDeliveryRun(id, ctx, t)
  })
}

export async function deliverDeliveryStop(
  runId: string,
  stopId: string,
  input: DeliveryStopDeliverInput,
  ctx: TenantContext,
  actorId: string,
) {
  return sequelize.transaction(async (t) => {
    const run = await loadRunForUpdate(runId, ctx, t)
    if (run.status !== 'dispatched' && run.status !== 'in_progress') {
      throw new Error('DELIVERY_RUN_INVALID_TRANSITION')
    }
    const stop = await DeliveryStop.findOne({
      where: { id: stopId, delivery_run_id: runId, org_id: ctx.orgId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    })
    if (!stop) throw new Error('DELIVERY_STOP_NOT_FOUND')
    if (['delivered', 'partial', 'failed', 'returned', 'skipped'].includes(stop.status)) {
      return getDeliveryRun(runId, ctx, t)
    }

    const links = await loadStopLinksWithShipments(stopId, ctx, t)
    if (links.length === 0) throw new Error('DELIVERY_RUN_SHIPMENTS_REQUIRED')
    const deliveredAt = input.delivered_at ?? new Date()
    const resultStatus = input.status
    const resultReason = input.delivery_result_reason ?? null
    const resultNotes = input.delivery_result_notes ?? null
    const description = input.description
      ?? (resultStatus === 'delivered'
        ? 'Entregado desde salida de reparto'
        : resultReason ?? DELIVERY_STOP_STATUS_LABEL[resultStatus])

    if (run.status === 'dispatched') {
      await run.update({ status: 'in_progress', updated_by: actorId }, { transaction: t })
    }

    for (const link of links) {
      if (!link.shipment || TERMINAL_SHIPMENT_STATUSES.includes(link.shipment.status)) continue
      const nextShipmentStatus: ShipmentStatus = resultStatus === 'partial' ? 'failed' : resultStatus
      assertShipmentTransition(link.shipment.status, nextShipmentStatus)
      await link.shipment.update(
        {
          status: nextShipmentStatus,
          delivered_at: resultStatus === 'delivered' ? deliveredAt : link.shipment.delivered_at,
          failure_reason: resultStatus === 'failed' || resultStatus === 'partial' ? description : link.shipment.failure_reason,
          delivery_result_reason: resultReason,
          delivery_result_notes: resultNotes,
          updated_by: actorId,
        },
        { transaction: t },
      )
      await ShipmentEvent.create(
        {
          shipment_id: link.shipment.id,
          org_id:      ctx.orgId,
          status:      nextShipmentStatus,
          description,
          occurred_at: deliveredAt,
          source:      'manual',
          created_by:  actorId,
        },
        { transaction: t },
      )
      if (resultStatus === 'delivered') {
        await syncOrderDeliveredState(link.shipment.sales_order_id, deliveredAt, actorId, t)
      }
      if (resultStatus === 'returned') {
        await restoreShippedQtyForRunShipment(link.shipment.id, t)
      }
    }

    await stop.update(
      {
        status: resultStatus,
        delivered_at: resultStatus === 'delivered' || resultStatus === 'partial' ? deliveredAt : stop.delivered_at,
        failure_reason: resultStatus === 'failed' || resultStatus === 'returned' || resultStatus === 'partial' ? description : null,
        delivery_result_reason: resultReason,
        delivery_result_notes: resultNotes,
        updated_by: actorId,
      },
      { transaction: t },
    )
    await completeRunIfReady(run, actorId, t)
    logger.info({ deliveryRunId: runId, stopId, orgId: ctx.orgId, actorId }, 'delivery stop delivered')
    return getDeliveryRun(runId, ctx, t)
  })
}

export async function cancelDeliveryRun(id: string, ctx: TenantContext, actorId: string, reason?: string) {
  return sequelize.transaction(async (t) => {
    assertFullLogisticsAccess(ctx)
    const run = await loadRunForUpdate(id, ctx, t)
    if (!RUN_EDITABLE_STATUSES.includes(run.status)) throw new Error('DELIVERY_RUN_CANCEL_FORBIDDEN')
    assertDeliveryRunTransition(run.status, 'cancelled')

    await run.update({ status: 'cancelled', notes: reason ?? run.notes, updated_by: actorId }, { transaction: t })
    await DeliveryStop.update(
      { status: 'skipped', failure_reason: reason ?? 'Salida cancelada', updated_by: actorId },
      { where: { delivery_run_id: id, org_id: ctx.orgId, status: 'pending' }, transaction: t },
    )
    logger.info({ deliveryRunId: id, reason, orgId: ctx.orgId, actorId }, 'delivery run cancelled')
    return getDeliveryRun(id, ctx, t)
  })
}

async function countShipmentsByRun(runIds: string[]): Promise<Map<string, number>> {
  if (runIds.length === 0) return new Map()
  const rows = await DeliveryRunShipment.findAll({
    where: { delivery_run_id: { [Op.in]: runIds } },
    attributes: ['delivery_run_id', [fn('COUNT', col('id')), 'shipment_count']],
    group: ['delivery_run_id'],
    raw: true,
  }) as unknown as CountRow[]

  return new Map(rows.map(row => [row.delivery_run_id, Number(row.shipment_count) || 0]))
}

async function loadRunForUpdate(id: string, ctx: TenantContext, t: Transaction): Promise<DeliveryRun> {
  const run = await DeliveryRun.findOne({
    where: { id, org_id: ctx.orgId },
    transaction: t,
    lock: t.LOCK.UPDATE,
  })
  if (!run) throw new Error('DELIVERY_RUN_NOT_FOUND')
  void whereBranch(ctx, run.branch_id)
  assertLogisticsAssignedScope(ctx, run, 'DELIVERY_RUN_NOT_FOUND')
  return run
}

function assertRunEditable(run: DeliveryRun): void {
  if (TERMINAL_DELIVERY_RUN_STATUSES.includes(run.status) || !RUN_EDITABLE_STATUSES.includes(run.status)) {
    throw new Error('DELIVERY_RUN_ALREADY_CLOSED')
  }
}

async function loadEligibleShipments(ids: string[], ctx: TenantContext, t: Transaction): Promise<ShipmentWithOrder[]> {
  const uniqueIds = [...new Set(ids)]
  const shipments = await Shipment.findAll({
    where: { id: { [Op.in]: uniqueIds }, org_id: ctx.orgId },
    include: [{ model: SalesOrder, as: 'salesOrder', attributes: ['id', 'order_number', 'status', 'contact_id'] }],
    transaction: t,
    lock: { level: t.LOCK.UPDATE, of: Shipment },
  }) as ShipmentWithOrder[]
  if (shipments.length !== uniqueIds.length) throw new Error('SHIPMENT_NOT_FOUND')

  for (const shipment of shipments) {
    void whereBranch(ctx, shipment.branch_id)
    if (shipment.status !== 'pending' && shipment.status !== 'ready_to_ship') {
      throw new Error('DELIVERY_RUN_SHIPMENT_NOT_ELIGIBLE')
    }
  }

  const assigned = await DeliveryRunShipment.count({
    where: { shipment_id: { [Op.in]: uniqueIds }, org_id: ctx.orgId },
    transaction: t,
  })
  if (assigned > 0) throw new Error('DELIVERY_RUN_SHIPMENT_ALREADY_ASSIGNED')
  return uniqueIds.map(id => {
    const shipment = shipments.find(row => row.id === id)
    if (!shipment) throw new Error('SHIPMENT_NOT_FOUND')
    return shipment
  })
}

function validateShipmentsForRun(shipments: Shipment[], branchId: string): void {
  if (shipments.length === 0) throw new Error('DELIVERY_RUN_SHIPMENTS_REQUIRED')
  if (shipments.some(shipment => shipment.branch_id !== branchId)) {
    throw new Error('DELIVERY_RUN_BRANCH_MISMATCH')
  }
}

async function validateRunProvider(
  providerKind: FulfillmentKind,
  carrierAccountId: string | null,
  branchId: string,
  ctx: TenantContext,
  t: Transaction,
): Promise<void> {
  if (!carrierAccountId) return
  const carrier = await CarrierAccount.findOne({
    where: { id: carrierAccountId, org_id: ctx.orgId, is_active: true },
    transaction: t,
  })
  if (!carrier) throw new Error('CARRIER_ACCOUNT_NOT_FOUND')
  if (carrier.branch_id && carrier.branch_id !== branchId) throw new Error('CARRIER_ACCOUNT_BRANCH_MISMATCH')
  if (carrier.kind !== providerKind) throw new Error('DELIVERY_RUN_PROVIDER_MISMATCH')
}

function validateShipmentProviderConsistency(
  shipments: Shipment[],
  providerKind: FulfillmentKind,
  carrierAccountId: string | null,
): void {
  for (const shipment of shipments) {
    if (shipment.provider_kind !== providerKind) throw new Error('DELIVERY_RUN_PROVIDER_MISMATCH')
    if ((shipment.carrier_account_id ?? null) !== (carrierAccountId ?? null)) {
      throw new Error('DELIVERY_RUN_PROVIDER_MISMATCH')
    }
  }
}

async function validateExistingRunShipmentProvider(
  run: DeliveryRun,
  providerKind: FulfillmentKind,
  carrierAccountId: string | null,
  t: Transaction,
): Promise<void> {
  const links = await loadRunLinksWithShipments(run.id, { orgId: run.org_id as string } as TenantContext, t)
  validateShipmentProviderConsistency(
    links.map(link => link.shipment).filter((shipment): shipment is Shipment => Boolean(shipment)),
    providerKind,
    carrierAccountId,
  )
}

async function resolveRunVehicle(
  providerKind: FulfillmentKind,
  input: { assigned_driver_id?: string | null; vehicle_id?: string | null; vehicle_ref?: string | null },
  ctx: TenantContext,
): Promise<{ vehicle_id: string | null; vehicle_ref: string | null }> {
  const touchesFleet = input.assigned_driver_id !== undefined || input.vehicle_id !== undefined || input.vehicle_ref !== undefined
  if (providerKind !== 'in_house') {
    if (touchesFleet && (input.assigned_driver_id || input.vehicle_id || input.vehicle_ref)) {
      throw new Error('DRIVER_ONLY_FOR_IN_HOUSE')
    }
    return { vehicle_id: null, vehicle_ref: null }
  }
  if (input.vehicle_id !== undefined) return resolveVehicleRef(input.vehicle_id, ctx)
  return { vehicle_id: null, vehicle_ref: input.vehicle_ref ?? null }
}

async function attachShipmentsToRun(
  run: DeliveryRun,
  shipments: ShipmentWithOrder[],
  ctx: TenantContext,
  actorId: string,
  t: Transaction,
): Promise<void> {
  const existingStops = await DeliveryStop.findAll({
    where: { delivery_run_id: run.id, org_id: ctx.orgId },
    transaction: t,
    lock: t.LOCK.UPDATE,
  })
  const stopsByKey = new Map(existingStops.map(stop => [stopKey(stop), stop]))
  let nextSequence = existingStops.reduce((max, stop) => Math.max(max, stop.sequence), 0) + 1

  for (const shipment of shipments) {
    const key = stopKey(shipment)
    let stop = stopsByKey.get(key)
    if (!stop) {
      stop = await DeliveryStop.create(
        {
          delivery_run_id:     run.id,
          org_id:              ctx.orgId,
          sequence:            nextSequence++,
          contact_id:          shipment.salesOrder?.contact_id ?? null,
          ship_to_name:        shipment.ship_to_name,
          ship_to_phone:       shipment.ship_to_phone,
          ship_street:         shipment.ship_street,
          ship_number:         shipment.ship_number,
          ship_floor:          shipment.ship_floor,
          ship_apartment:      shipment.ship_apartment,
          ship_city:           shipment.ship_city,
          ship_province:       shipment.ship_province,
          ship_postal_code:    shipment.ship_postal_code,
          ship_country:        shipment.ship_country,
          cod_expected_amount: null,
          created_by:          actorId,
          updated_by:          actorId,
        },
        { transaction: t },
      )
      stopsByKey.set(key, stop)
    }

    await DeliveryRunShipment.create(
      {
        delivery_run_id:  run.id,
        delivery_stop_id: stop.id,
        shipment_id:      shipment.id,
        org_id:           ctx.orgId,
        created_by:       actorId,
        updated_by:       actorId,
      },
      { transaction: t },
    )
  }
}

function stopKey(stop: {
  contact_id?: string | null
  ship_street?: string | null
  ship_number?: string | null
  ship_floor?: string | null
  ship_apartment?: string | null
  ship_city?: string | null
  ship_province?: string | null
  ship_postal_code?: string | null
}): string {
  return [
    stop.contact_id ?? '',
    stop.ship_street ?? '',
    stop.ship_number ?? '',
    stop.ship_floor ?? '',
    stop.ship_apartment ?? '',
    stop.ship_city ?? '',
    stop.ship_province ?? '',
    stop.ship_postal_code ?? '',
  ].map(part => part.trim().toLowerCase()).join('|')
}

async function loadRunLinksWithShipments(runId: string, ctx: TenantContext, t: Transaction): Promise<RunDetailLink[]> {
  return DeliveryRunShipment.findAll({
    where: { delivery_run_id: runId, org_id: ctx.orgId },
    include: [
      {
        model: Shipment,
        as: 'shipment',
        include: [
          { model: SalesOrder, as: 'salesOrder', attributes: ['id', 'order_number', 'status', 'contact_id'] },
        ],
      },
    ],
    transaction: t,
    lock: { level: t.LOCK.UPDATE, of: DeliveryRunShipment },
  }) as Promise<RunDetailLink[]>
}

async function loadStopLinksWithShipments(stopId: string, ctx: TenantContext, t: Transaction): Promise<RunDetailLink[]> {
  return DeliveryRunShipment.findAll({
    where: { delivery_stop_id: stopId, org_id: ctx.orgId },
    include: [{ model: Shipment, as: 'shipment' }],
    transaction: t,
    lock: { level: t.LOCK.UPDATE, of: DeliveryRunShipment },
  }) as Promise<RunDetailLink[]>
}

async function dispatchShipmentInRun(
  shipment: Shipment,
  input: { assignedDriverId: string | null; vehicleId: string | null; vehicleRef: string | null; dispatchedAt: Date },
  ctx: TenantContext,
  actorId: string,
  t: Transaction,
): Promise<void> {
  assertShipmentTransition(shipment.status, 'dispatched')
  await assertShipmentHasIssuedDeliveryNote(shipment.id, ctx.orgId, t)
  if (shipment.provider_kind !== 'in_house' && input.assignedDriverId) throw new Error('DRIVER_ONLY_FOR_IN_HOUSE')

  const items = await ShipmentItem.findAll({ where: { shipment_id: shipment.id }, transaction: t })
  const provider = getFulfillmentProvider(shipment.provider_kind)
  const result = await provider.dispatch({
    shipmentNumber: shipment.shipment_number,
    trackingNumber: shipment.tracking_number,
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

  const trackingNumber = result.trackingNumber ?? shipment.tracking_number
  await shipment.update(
    {
      status:             'dispatched',
      dispatched_at:      input.dispatchedAt,
      tracking_number:    trackingNumber,
      tracking_url:       result.trackingUrl ?? (trackingNumber ? trackingUrlFor(shipment.provider_kind, trackingNumber) : null),
      label_url:          result.labelUrl ?? shipment.label_url,
      shipping_cost:      result.cost ?? shipment.shipping_cost,
      assigned_driver_id: input.assignedDriverId ?? shipment.assigned_driver_id,
      vehicle_id:         input.vehicleId,
      vehicle_ref:        input.vehicleRef,
      updated_by:         actorId,
    },
    { transaction: t },
  )
  await ShipmentEvent.create(
    {
      shipment_id: shipment.id,
      org_id:      ctx.orgId,
      status:      'dispatched',
      description: 'Despachado desde salida de reparto',
      source:      'system',
      created_by:  actorId,
    },
    { transaction: t },
  )
}

async function restoreShippedQtyForRunShipment(shipmentId: string, t: Transaction): Promise<void> {
  const items = await ShipmentItem.findAll({ where: { shipment_id: shipmentId }, transaction: t })
  for (const item of items) {
    await SalesOrderItem.decrement('shipped_qty', {
      by: new Decimal(item.quantity).toNumber(),
      where: { id: item.sales_order_item_id },
      transaction: t,
    })
  }
}

async function completeRunIfReady(run: DeliveryRun, actorId: string, t: Transaction): Promise<void> {
  const openStops = await DeliveryStop.count({
    where: {
      delivery_run_id: run.id,
      status: { [Op.in]: ['pending', 'arrived'] },
    },
    transaction: t,
  })
  if (openStops > 0) return
  await run.update({ status: 'completed', completed_at: new Date(), updated_by: actorId }, { transaction: t })
}

async function syncOrderDeliveredState(orderId: string, deliveredAt: Date, actorId: string, t: Transaction): Promise<void> {
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
      status: { [Op.notIn]: TERMINAL_SHIPMENT_STATUSES },
    },
    transaction: t,
  })
  if (openShipments > 0) return

  await order.update(
    { status: 'delivered', delivered_date: deliveredAt, updated_by: actorId },
    { transaction: t },
  )
}
