import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/session-org', () => ({
  resolveOrgIdForMutation: vi.fn(async (user: { orgId: string | null }) => user.orgId),
}))

vi.mock('@/modules/auth/role-permission.model', () => ({
  default: { findAll: vi.fn() },
}))
vi.mock('@/modules/auth/org-role-permission.model', () => ({
  default: { findAll: vi.fn() },
}))
vi.mock('@/modules/auth/permission.model', () => ({
  default: {},
}))

import RolePermission from '@/modules/auth/role-permission.model'
import OrgRolePermission from '@/modules/auth/org-role-permission.model'
import {
  can,
  canSettings,
  getPermissionsForUser,
  requirePermission,
  ForbiddenError,
} from './permissions'

const mockRoleFindAll = vi.mocked(RolePermission.findAll)
const mockOrgRoleFindAll = vi.mocked(OrgRolePermission.findAll)

function makeRow(name: string, orgId: string | null = null) {
  return { org_id: orgId, permission: { name } } as unknown as Awaited<ReturnType<typeof RolePermission.findAll>>[number]
}

function makeOrgRoleRow(name: string) {
  return { permission: { name } } as unknown as Awaited<ReturnType<typeof OrgRolePermission.findAll>>[number]
}

beforeEach(() => vi.clearAllMocks())

describe('can()', () => {
  it('sys-admin bypasses DB entirely', async () => {
    const result = await can('sys-admin', 'contacts:read')
    expect(mockRoleFindAll).not.toHaveBeenCalled()
    expect(result).toBe(true)
  })

  it('returns true when role has permission (global default)', async () => {
    mockRoleFindAll.mockResolvedValue([makeRow('contacts:read')])
    expect(await can('admin', 'contacts:read')).toBe(true)
  })

  it('returns false when permission is not in the list', async () => {
    mockRoleFindAll.mockResolvedValue([makeRow('contacts:read')])
    expect(await can('readonly', 'contacts:write')).toBe(false)
  })

  it('uses org-specific overrides when present', async () => {
    const orgId = 'org-1'
    mockRoleFindAll.mockResolvedValue([
      makeRow('contacts:read', orgId),
      makeRow('contacts:write', orgId),
    ])
    expect(await can('operator', 'contacts:write', orgId)).toBe(true)
  })

  it('denies settings:write for operator', async () => {
    mockRoleFindAll.mockResolvedValue([makeRow('sales:read'), makeRow('sales:write')])
    expect(await can('operator', 'settings:write', 'org-1')).toBe(false)
  })

  it('denies settings permissions when user has custom org role', async () => {
    mockOrgRoleFindAll.mockResolvedValue([makeOrgRoleRow('sales:read')])
    expect(await can('operator', 'settings:read', 'org-1', 'role-uuid')).toBe(false)
  })
})

describe('getPermissionsForUser()', () => {
  it('returns module and panel permissions from custom org role', async () => {
    mockOrgRoleFindAll.mockResolvedValue([
      makeOrgRoleRow('contacts:read'),
      makeOrgRoleRow('panel:read'),
    ])
    const perms = await getPermissionsForUser({ role: 'operator', orgRoleId: 'role-uuid' }, 'org-1')
    expect(perms).toEqual(['contacts:read', 'panel:read'])
    expect(mockRoleFindAll).not.toHaveBeenCalled()
  })

  it('returns module permissions from custom org role', async () => {
    mockOrgRoleFindAll.mockResolvedValue([
      makeOrgRoleRow('contacts:read'),
      makeOrgRoleRow('contacts:write'),
    ])
    const perms = await getPermissionsForUser({ role: 'operator', orgRoleId: 'role-uuid' }, 'org-1')
    expect(perms).toEqual(['contacts:read', 'contacts:write'])
    expect(mockRoleFindAll).not.toHaveBeenCalled()
  })

  it('includes settings permissions for built-in admin only', async () => {
    mockRoleFindAll.mockResolvedValue([
      makeRow('settings:read'),
      makeRow('settings:write'),
      makeRow('contacts:read'),
    ])
    const perms = await getPermissionsForUser({ role: 'admin', orgRoleId: null }, 'org-1')
    expect(perms).toContain('settings:read')
    expect(perms).toContain('settings:write')
  })

  it('strips settings permissions from non-admin roles', async () => {
    mockRoleFindAll.mockResolvedValue([
      makeRow('settings:read'),
      makeRow('sales:read'),
    ])
    const perms = await getPermissionsForUser({ role: 'operator', orgRoleId: null }, 'org-1')
    expect(perms).not.toContain('settings:read')
    expect(perms).toContain('sales:read')
  })
})

describe('canSettings()', () => {
  it('allows built-in admin with settings:read', async () => {
    mockRoleFindAll.mockResolvedValue([makeRow('settings:read')])
    await expect(
      canSettings({ role: 'admin', orgRoleId: null }, 'settings:read', 'org-1'),
    ).resolves.toBe(true)
  })

  it('denies custom org role even if underlying role is operator', async () => {
    mockOrgRoleFindAll.mockResolvedValue([makeOrgRoleRow('sales:read')])
    await expect(
      canSettings({ role: 'operator', orgRoleId: 'custom' }, 'settings:read', 'org-1'),
    ).resolves.toBe(false)
  })
})

describe('requirePermission()', () => {
  it('resolves when permission is granted', async () => {
    mockRoleFindAll.mockResolvedValue([makeRow('contacts:write')])
    await expect(requirePermission('admin', 'contacts:write')).resolves.toBeUndefined()
  })

  it('throws ForbiddenError when permission is denied', async () => {
    mockRoleFindAll.mockResolvedValue([])
    await expect(requirePermission('readonly', 'contacts:delete')).rejects.toThrow(ForbiddenError)
  })

  it('ForbiddenError carries FORBIDDEN code', async () => {
    mockRoleFindAll.mockResolvedValue([])
    const err = await requirePermission('readonly', 'contacts:delete').catch(e => e)
    expect(err.code).toBe('FORBIDDEN')
  })
})
