import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const transactionMock = vi.fn(async (fn: (t: unknown) => unknown) => fn({}))
vi.mock('@/lib/db', () => ({
  default: { transaction: transactionMock },
}))

const orgRoleFindOne = vi.fn()
const orgRoleFindAll = vi.fn().mockResolvedValue([])
vi.mock('@/modules/auth/org-role.model', () => ({
  default: { findOne: orgRoleFindOne, findAll: orgRoleFindAll },
}))

const orgRolePermissionDestroy = vi.fn()
const orgRolePermissionBulkCreate = vi.fn()
const orgRolePermissionFindAll = vi.fn().mockResolvedValue([])
vi.mock('@/modules/auth/org-role-permission.model', () => ({
  default: { destroy: orgRolePermissionDestroy, bulkCreate: orgRolePermissionBulkCreate, findAll: orgRolePermissionFindAll },
}))

const permissionFindAll = vi.fn()
vi.mock('@/modules/auth/permission.model', () => ({
  default: { findAll: permissionFindAll },
}))

vi.mock('@/modules/auth/user.model', () => ({ default: { findAll: vi.fn().mockResolvedValue([]) } }))
// getPermissionsForRole (real, unmocked @/lib/permissions) reads builtin-role grants via this model.
vi.mock('@/modules/auth/role-permission.model', () => ({
  default: { findAll: vi.fn().mockResolvedValue([]) },
}))
vi.mock('@/lib/capabilities-cache', () => ({
  invalidateCapabilitiesForOrg: vi.fn(),
  currentGlobalGeneration: vi.fn().mockReturnValue(0),
  currentOrgGeneration: vi.fn().mockReturnValue(0),
}))

describe('auth/org-roles.service — attendance:scope_own matrix support', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updateOrgRolesMatrix accepts attendance:scope_own as a valid assignable permission', async () => {
    orgRoleFindOne.mockResolvedValue({ id: 'role1' })
    permissionFindAll.mockResolvedValue([{ id: 'perm1', name: 'attendance:scope_own' }])

    const { updateOrgRolesMatrix } = await import('./org-roles.service')

    await expect(updateOrgRolesMatrix('org1', {
      updates: [{ orgRoleId: 'role1', permissionNames: ['attendance:scope_own'] }],
    })).resolves.not.toThrow()

    expect(orgRolePermissionBulkCreate).toHaveBeenCalledWith(
      [{ org_role_id: 'role1', permission_id: 'perm1' }],
      expect.anything(),
    )
  })
})
