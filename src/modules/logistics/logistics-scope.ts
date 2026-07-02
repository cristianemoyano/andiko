import type { WhereOptions } from 'sequelize'
import type { TenantContext } from '@/lib/tenancy'

export function isWithinLogisticsAssignedScope(
  ctx: TenantContext,
  shipment: { assigned_driver_id: string | null },
): boolean {
  if (!ctx.logisticsScopeAssigned || !ctx.userId) return true
  return shipment.assigned_driver_id === ctx.userId
}

export function whereLogisticsAssignedScope(ctx: TenantContext): WhereOptions {
  if (!ctx.logisticsScopeAssigned || !ctx.userId) return {}
  return { assigned_driver_id: ctx.userId }
}

/** Blocks fleet / carrier / shipment-creation operations for scoped repartidores. */
export function assertFullLogisticsAccess(ctx: TenantContext): void {
  if (ctx.logisticsScopeAssigned) throw new Error('LOGISTICS_SCOPE_FORBIDDEN')
}

export function assertLogisticsAssignedScope(
  ctx: TenantContext,
  shipment: { assigned_driver_id: string | null },
): void {
  if (!isWithinLogisticsAssignedScope(ctx, shipment)) {
    throw new Error('SHIPMENT_NOT_FOUND')
  }
}
