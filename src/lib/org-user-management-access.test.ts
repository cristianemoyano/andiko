import { describe, it, expect } from 'vitest'
import { canManageOrgUserFromList, orgUserManagementPeerKey } from '@/lib/org-user-management-access'

describe('orgUserManagementPeerKey()', () => {
  it('identifies built-in Gerente and Encargado tiers', () => {
    expect(orgUserManagementPeerKey('admin', null)).toBe('builtin:admin')
    expect(orgUserManagementPeerKey('branch-admin', null)).toBe('builtin:branch-admin')
    expect(orgUserManagementPeerKey('operator', 'role-1')).toBeNull()
  })
})

describe('canManageOrgUserFromList()', () => {
  const gerenteA = { id: 'a', role: 'admin' as const, org_role_id: null }
  const gerenteB = { id: 'b', role: 'admin' as const, org_role_id: null }
  const vendedor = { id: 'c', role: 'operator' as const, org_role_id: 'role-v' }

  it('blocks self edit', () => {
    expect(canManageOrgUserFromList(gerenteA, gerenteA)).toBe(false)
  })

  it('blocks peer Gerente edit', () => {
    expect(canManageOrgUserFromList(gerenteA, gerenteB)).toBe(false)
  })

  it('allows editing managed custom-role users', () => {
    expect(canManageOrgUserFromList(gerenteA, vendedor)).toBe(true)
  })
})
