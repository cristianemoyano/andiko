import 'server-only'
import { Op } from 'sequelize'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import type { TenantContext } from '@/lib/tenancy'
import { assertFullLogisticsAccess } from './logistics-scope'
import Vehicle from './vehicle.model'
import type { VehicleInput, VehicleQuery, VehicleUpdateInput } from './vehicle.schema'
import { formatVehicleRef } from './vehicle.schema'

const LIST_ATTRIBUTES = ['id', 'branch_id', 'label', 'plate', 'notes', 'is_active', 'created_at', 'updated_at'] as const

export async function listVehicles(query: VehicleQuery, ctx: TenantContext) {
  const { page, limit, branch_id, is_active, search } = query
  const { offset } = paginate(page, limit)

  const { rows, count } = await Vehicle.findAndCountAll({
    where: {
      org_id: ctx.orgId,
      ...(is_active !== undefined ? { is_active } : {}),
      ...(branch_id ? { [Op.or]: [{ branch_id }, { branch_id: null }] } : {}),
      ...(search
        ? {
            [Op.or]: [
              { label: { [Op.iLike]: `%${search}%` } },
              { plate: { [Op.iLike]: `%${search}%` } },
            ],
          }
        : {}),
    },
    attributes: [...LIST_ATTRIBUTES],
    limit,
    offset,
    order: [['label', 'ASC']],
  })

  return toPaginated(rows.map(r => r.get({ plain: true })), count, page, limit)
}

export async function getVehicle(id: string, ctx: TenantContext) {
  const vehicle = await Vehicle.findOne({
    where: { id, org_id: ctx.orgId },
    attributes: [...LIST_ATTRIBUTES],
  })
  if (!vehicle) throw new Error('VEHICLE_NOT_FOUND')
  return vehicle.get({ plain: true })
}

export async function createVehicle(input: VehicleInput, ctx: TenantContext, actorId: string) {
  assertFullLogisticsAccess(ctx)
  const vehicle = await Vehicle.create({
    ...input,
    org_id: ctx.orgId,
    created_by: actorId,
    updated_by: actorId,
  })
  logger.info({ vehicleId: vehicle.id, orgId: ctx.orgId, actorId }, 'vehicle created')
  return getVehicle(vehicle.id, ctx)
}

export async function updateVehicle(id: string, input: VehicleUpdateInput, ctx: TenantContext, actorId: string) {
  assertFullLogisticsAccess(ctx)
  const vehicle = await Vehicle.findOne({ where: { id, org_id: ctx.orgId } })
  if (!vehicle) throw new Error('VEHICLE_NOT_FOUND')
  await vehicle.update({ ...input, updated_by: actorId })
  logger.info({ vehicleId: id, orgId: ctx.orgId, actorId }, 'vehicle updated')
  return getVehicle(id, ctx)
}

export async function deleteVehicle(id: string, ctx: TenantContext, actorId: string) {
  assertFullLogisticsAccess(ctx)
  const vehicle = await Vehicle.findOne({ where: { id, org_id: ctx.orgId } })
  if (!vehicle) throw new Error('VEHICLE_NOT_FOUND')
  await vehicle.update({ is_active: false, deleted_by: actorId })
  await vehicle.destroy()
  logger.info({ vehicleId: id, orgId: ctx.orgId, actorId }, 'vehicle deleted')
}

export async function resolveVehicleRef(
  vehicleId: string | null | undefined,
  ctx: TenantContext,
): Promise<{ vehicle_id: string | null; vehicle_ref: string | null }> {
  if (!vehicleId) return { vehicle_id: null, vehicle_ref: null }
  const vehicle = await Vehicle.findOne({
    where: { id: vehicleId, org_id: ctx.orgId, is_active: true },
    attributes: ['id', 'label', 'plate'],
  })
  if (!vehicle) throw new Error('VEHICLE_NOT_FOUND')
  const plain = vehicle.get({ plain: true }) as { id: string; label: string; plate: string | null }
  return { vehicle_id: plain.id, vehicle_ref: formatVehicleRef(plain) }
}
