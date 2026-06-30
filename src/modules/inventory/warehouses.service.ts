import 'server-only'
import Decimal from 'decimal.js'
import { Op } from 'sequelize'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import type { TenantContext } from '@/lib/tenancy'
import Warehouse from './warehouse.model'
import type { WarehouseInput, WarehouseUpdateInput, WarehouseQuery } from './warehouse.schema'
import type { Transaction } from 'sequelize'

export async function listWarehouses(query: WarehouseQuery, ctx: TenantContext) {
  const { page, limit, search, branch_id } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = { org_id: ctx.orgId }
  if (branch_id) where.branch_id = branch_id
  if (search) {
    where[Op.or as unknown as string] = [
      { name: { [Op.iLike]: `%${search}%` } },
    ]
  }

  const { rows, count } = await Warehouse.findAndCountAll({
    where,
    limit,
    offset,
    order: [['name', 'ASC']],
    attributes: ['id', 'org_id', 'branch_id', 'name', 'description', 'is_active', 'default_minimum_quantity', 'created_at'],
  })

  return toPaginated(rows, count, page, limit)
}

export async function getWarehouse(id: string, orgId: string) {
  const warehouse = await Warehouse.findOne({ where: { id, org_id: orgId } })
  if (!warehouse) throw new Error('WAREHOUSE_NOT_FOUND')
  return warehouse
}

function withDecimalDefaultMinimum<T extends { default_minimum_quantity?: number }>(input: T) {
  const { default_minimum_quantity, ...rest } = input
  if (default_minimum_quantity === undefined) return rest
  return {
    ...rest,
    default_minimum_quantity: new Decimal(default_minimum_quantity).toFixed(4),
  }
}

export async function createWarehouse(input: WarehouseInput, ctx: TenantContext, actorId: string) {
  const warehouse = await Warehouse.create({
    ...withDecimalDefaultMinimum(input),
    org_id:     ctx.orgId,
    created_by: actorId,
    updated_by: actorId,
  })
  logger.info({ warehouseId: warehouse.id, orgId: ctx.orgId, actorId }, 'warehouse created')
  return warehouse
}

export async function updateWarehouse(id: string, input: WarehouseUpdateInput, ctx: TenantContext, actorId: string) {
  const warehouse = await Warehouse.findOne({ where: { id, org_id: ctx.orgId } })
  if (!warehouse) throw new Error('WAREHOUSE_NOT_FOUND')

  await warehouse.update({ ...withDecimalDefaultMinimum(input), updated_by: actorId })
  logger.info({ warehouseId: id, orgId: ctx.orgId, actorId }, 'warehouse updated')
  return warehouse
}

export async function deleteWarehouse(id: string, ctx: TenantContext, actorId: string) {
  const warehouse = await Warehouse.findOne({ where: { id, org_id: ctx.orgId } })
  if (!warehouse) throw new Error('WAREHOUSE_NOT_FOUND')

  await warehouse.update({ deleted_by: actorId })
  await warehouse.destroy()
  logger.info({ warehouseId: id, orgId: ctx.orgId, actorId }, 'warehouse soft-deleted')
}

export async function resolveDefaultWarehouse(
  branchId: string | null,
  orgId: string,
  t?: Transaction,
): Promise<string | null> {
  // Try branch-specific warehouse first, then fall back to any org warehouse
  const candidates = branchId
    ? [{ org_id: orgId, is_active: true, branch_id: branchId }, { org_id: orgId, is_active: true }]
    : [{ org_id: orgId, is_active: true }]

  for (const where of candidates) {
    const warehouse = await Warehouse.findOne({
      where,
      order: [['created_at', 'ASC']],
      attributes: ['id'],
      transaction: t,
    })
    if (warehouse) return warehouse.id
  }

  return null
}

export async function resolveWarehouseForBranch(
  branchId: string | null,
  orgId: string,
  t?: Transaction,
): Promise<string | null> {
  return resolveDefaultWarehouse(branchId, orgId, t)
}
