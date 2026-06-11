import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/modules/auth/role-permission.model', () => ({
  default: { findAll: vi.fn() },
}))
vi.mock('@/modules/auth/permission.model', () => ({
  default: {},
}))

import RolePermission from '@/modules/auth/role-permission.model'
import { can, requirePermission, ForbiddenError } from './permissions'

const mockFindAll = vi.mocked(RolePermission.findAll)

function makeRow(name: string, orgId: string | null = null) {
  return { org_id: orgId, permission: { name } } as unknown as Awaited<ReturnType<typeof RolePermission.findAll>>[number]
}

beforeEach(() => vi.clearAllMocks())

describe('can()', () => {
  it('sys-admin bypasses DB entirely', async () => {
    const result = await can('sys-admin', 'contacts:read')
    expect(mockFindAll).not.toHaveBeenCalled()
    expect(result).toBe(true)
  })

  it('returns true when role has permission (global default)', async () => {
    mockFindAll.mockResolvedValue([makeRow('contacts:read')])
    expect(await can('admin', 'contacts:read')).toBe(true)
  })

  it('returns false when permission is not in the list', async () => {
    mockFindAll.mockResolvedValue([makeRow('contacts:read')])
    expect(await can('readonly', 'contacts:write')).toBe(false)
  })

  it('uses org-specific overrides when present', async () => {
    const orgId = 'org-1'
    mockFindAll.mockResolvedValue([
      makeRow('contacts:read', orgId),
      makeRow('contacts:write', orgId),
    ])
    expect(await can('operator', 'contacts:write', orgId)).toBe(true)
  })

  it('falls back to global defaults when org has no overrides', async () => {
    mockFindAll.mockResolvedValue([makeRow('contacts:read', null)])
    expect(await can('readonly', 'contacts:read', 'org-1')).toBe(true)
  })
})

describe('requirePermission()', () => {
  it('resolves when permission is granted', async () => {
    mockFindAll.mockResolvedValue([makeRow('contacts:write')])
    await expect(requirePermission('admin', 'contacts:write')).resolves.toBeUndefined()
  })

  it('throws ForbiddenError when permission is denied', async () => {
    mockFindAll.mockResolvedValue([])
    await expect(requirePermission('readonly', 'contacts:delete')).rejects.toThrow(ForbiddenError)
  })

  it('ForbiddenError carries FORBIDDEN code', async () => {
    mockFindAll.mockResolvedValue([])
    const err = await requirePermission('readonly', 'contacts:delete').catch(e => e)
    expect(err.code).toBe('FORBIDDEN')
  })
})
