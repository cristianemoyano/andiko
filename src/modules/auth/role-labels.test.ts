import { describe, expect, it } from 'vitest'
import {
  CUSTOM_ORG_ROLE_CARRIER,
  isCustomOrgRoleCarrier,
  isLegacyBuiltinRole,
  isStandaloneLegacyOperator,
  resolveUserRoleBadgeStatus,
  resolveUserRoleLabel,
} from './role-labels'

describe('role-labels legacy operator', () => {
  it('marks operator as legacy builtin', () => {
    expect(isLegacyBuiltinRole('operator')).toBe(true)
    expect(isLegacyBuiltinRole('admin')).toBe(false)
  })

  it('distinguishes custom org role carrier from standalone legacy operator', () => {
    expect(isCustomOrgRoleCarrier(CUSTOM_ORG_ROLE_CARRIER, 'role-uuid')).toBe(true)
    expect(isStandaloneLegacyOperator(CUSTOM_ORG_ROLE_CARRIER, 'role-uuid')).toBe(false)
    expect(isStandaloneLegacyOperator(CUSTOM_ORG_ROLE_CARRIER, null)).toBe(true)
  })

  it('shows org role name instead of Operativo for custom roles', () => {
    expect(resolveUserRoleLabel('operator', 'Vendedor')).toBe('Vendedor')
    expect(resolveUserRoleLabel('operator')).toBe('Operativo (legacy)')
  })

  it('uses neutral badge for standalone legacy operator only', () => {
    expect(resolveUserRoleBadgeStatus('operator', null)).toBe('neutral')
    expect(resolveUserRoleBadgeStatus('operator', 'role-uuid')).toBe('neutral')
    expect(resolveUserRoleBadgeStatus('admin', null)).toBe('success')
  })
})
