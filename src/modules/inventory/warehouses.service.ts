import 'server-only'
import Decimal from 'decimal.js'
import { Op } from 'sequelize'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import type { TenantContext } from '@/lib/tenancy'
import Warehouse from './warehouse.model'
import type { WarehouseInput, WarehouseUpdateInput, WarehouseQuery } from './warehouse.schema'
import type { Transaction } from 'sequelize'
import { resolveWarehouseForBranch } from './branch-warehouse.resolution'

export { resolveWarehouseForBranch, BranchWarehouseResolutionError } from './branch-warehouse.resolution'

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

async function assertBranchWarehouseAssignable(
  orgId: string,
  branchId: string | null | undefined,
  excludeWarehouseId?: string,
  transaction?: Transaction,
): Promise<void> {
  if (!branchId) return

  const where: Record<string, unknown> = {
    org_id: orgId,
    branch_id: branchId,
    is_active: true,
  }
  if (excludeWarehouseId) {
    where.id = { [Op.ne]: excludeWarehouseId }
  }

  const existing = await Warehouse.count({ where, transaction })
  if (existing > 0) {
    throw new Error('BRANCH_WAREHOUSE_ALREADY_ASSIGNED')
  }
}

export async function createWarehouse(input: WarehouseInput, ctx: TenantContext, actorId: string) {
  await assertBranchWarehouseAssignable(ctx.orgId, input.branch_id)
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

  const nextBranchId = input.branch_id !== undefined ? input.branch_id : warehouse.branch_id
  const nextIsActive = input.is_active !== undefined ? input.is_active : warehouse.is_active
  if (nextBranchId && nextIsActive) {
    await assertBranchWarehouseAssignable(ctx.orgId, nextBranchId, id)
  }

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

/** @deprecated Usar `resolveWarehouseForBranch`. Alias mantenido por compatibilidad interna. */
export async function resolveDefaultWarehouse(
  branchId: string | null,
  orgId: string,
  t?: Transaction,
): Promise<string> {
  return resolveWarehouseForBranch(branchId, orgId, t)
}
