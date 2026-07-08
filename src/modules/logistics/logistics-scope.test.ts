import { describe, expect, it } from 'vitest'
import {
  assertFullLogisticsAccess,
  assertLogisticsAssignedScope,
  isWithinLogisticsAssignedScope,
  whereLogisticsAssignedScope,
} from './logistics-scope'
import type { TenantContext } from '@/lib/tenancy'

const baseCtx: TenantContext = {
  orgId: 'org-1',
  userId: 'user-1',
  defaultBranchId: null,
  allowedBranchIds: [],
}

describe('logistics-scope', () => {
  it('does not scope when logisticsScopeAssigned is false', () => {
    expect(whereLogisticsAssignedScope(baseCtx)).toEqual({})
    expect(isWithinLogisticsAssignedScope(baseCtx, { assigned_driver_id: 'other' })).toBe(true)
  })

  it('scopes lists to assigned repartidor', () => {
    const ctx = { ...baseCtx, logisticsScopeAssigned: true }
    expect(whereLogisticsAssignedScope(ctx)).toEqual({ assigned_driver_id: 'user-1' })
    expect(isWithinLogisticsAssignedScope(ctx, { assigned_driver_id: 'user-1' })).toBe(true)
    expect(isWithinLogisticsAssignedScope(ctx, { assigned_driver_id: 'other' })).toBe(false)
  })

  it('blocks fleet operations for scoped repartidores', () => {
    expect(() => assertFullLogisticsAccess({ ...baseCtx, logisticsScopeAssigned: true }))
      .toThrow('LOGISTICS_SCOPE_FORBIDDEN')
  })

  it('hides foreign shipments as not found', () => {
    expect(() => assertLogisticsAssignedScope(
      { ...baseCtx, logisticsScopeAssigned: true },
      { assigned_driver_id: 'other' },
    )).toThrow('SHIPMENT_NOT_FOUND')
  })

  it('supports domain-specific not found codes for delivery runs', () => {
    expect(() => assertLogisticsAssignedScope(
      { ...baseCtx, logisticsScopeAssigned: true },
      { assigned_driver_id: 'other' },
      'DELIVERY_RUN_NOT_FOUND',
    )).toThrow('DELIVERY_RUN_NOT_FOUND')
  })
})
