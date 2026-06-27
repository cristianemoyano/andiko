import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/session-org', () => ({
  resolveOrgIdForMutation: vi.fn(async () => 'org-1'),
}))
vi.mock('@/lib/permissions', () => ({
  getPermissionsForUser: vi.fn(),
  isModulePermission: (p: string) =>
    p.includes(':') && !p.startsWith('settings:') && !p.startsWith('panel:'),
  isPanelPermission: (p: string) => p === 'panel:read',
  isSettingsPermission: (p: string) => p.startsWith('settings:'),
}))

import { getPermissionsForUser } from '@/lib/permissions'
import { clearCapabilitiesCache } from '@/lib/capabilities-cache'
import { resolveCapabilities } from '@/lib/capabilities'
import type { Session } from 'next-auth'
import type { UserRole } from '@/types/roles'

const mockGetPermissions = vi.mocked(getPermissionsForUser)

function session(overrides: Partial<{
  role: UserRole
  realRole: UserRole
  orgId: string | null
  orgRoleId: string | null
  impersonation: { userId: string; email: string; name: string; role: UserRole } | null
}> = {}): Session {
  const role = overrides.role ?? 'admin'
  const realRole = overrides.realRole ?? role
  const orgId = overrides.orgId !== undefined ? overrides.orgId : 'org-1'
  return {
    expires: '2099-01-01T00:00:00.000Z',
    user: {
      id: 'user-1',
      email: 'admin@test.com',
      name: 'Admin',
      role,
      orgId,
      branchId: null,
      orgRoleId: overrides.orgRoleId ?? null,
      actingOrgId: null,
      realRole,
      realOrgId: orgId,
      realBranchId: null,
      impersonation: overrides.impersonation ?? null,
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  clearCapabilitiesCache()
  mockGetPermissions.mockResolvedValue(['settings:read', 'settings:write', 'contacts:read', 'panel:read'])
})

describe('resolveCapabilities()', () => {
  it('returns null without session', async () => {
    expect(await resolveCapabilities(null)).toBeNull()
  })

  it('enables org admin organization detail with settings API namespace', async () => {
    const caps = await resolveCapabilities(session())
    expect(caps?.nav.panel).toBe(true)
    expect(caps?.nav.panelBranchId).toBeNull()
    expect(caps?.organizacion.apiNamespace).toBe('settings')
    expect(caps?.organizacion.sections.users).toBe(true)
    expect(caps?.organizacion.sections.enabledModules).toBe(false)
    expect(caps?.nav.organizacionesHref).toBe('/organizaciones/org-1')
    expect(caps?.nav.facturacion).toBe(true)
    expect(caps?.onboarding.manage).toBe(true)
  })

  it('gives sys-admin platform list and sys-admin API namespace', async () => {
    mockGetPermissions.mockResolvedValue(['contacts:read'])
    const caps = await resolveCapabilities(session({ role: 'sys-admin', realRole: 'sys-admin', orgId: null }))
    expect(caps?.platform.listOrganizations).toBe(true)
    expect(caps?.organizacion.apiNamespace).toBe('sys-admin')
    expect(caps?.nav.organizacionesHref).toBe('/organizaciones')
    expect(caps?.nav.facturacion).toBe(false)
    expect(caps?.configuracion.tabs.apariencia).toBe(true)
    expect(caps?.configuracion.tabs.impresion).toBe(false)
    expect(caps?.configuracion.tabs.afip).toBe(false)
    expect(caps?.onboarding.manage).toBe(false)
  })

  it('hides facturacion dashboard for branch-admin without settings', async () => {
    mockGetPermissions.mockResolvedValue(['sales:read', 'sales:write', 'panel:read'])
    const caps = await resolveCapabilities(session({ role: 'branch-admin', realRole: 'branch-admin' }))
    expect(caps?.nav.facturacion).toBe(false)
  })

  it('shows facturacion dashboard for sys-admin impersonating an org admin', async () => {
    mockGetPermissions.mockResolvedValue(['settings:read', 'contacts:read'])
    const caps = await resolveCapabilities(session({
      role: 'admin',
      realRole: 'sys-admin',
      impersonation: { userId: 'org-admin', email: 'a@test.com', name: 'Gerente', role: 'admin' as UserRole },
    }))
    expect(caps?.nav.facturacion).toBe(true)
  })

  it('hides organization nav for branch-admin without settings', async () => {
    mockGetPermissions.mockResolvedValue(['sales:read', 'sales:write', 'panel:read'])
    const caps = await resolveCapabilities(session({
      role: 'branch-admin',
      realRole: 'branch-admin',
    }))
    expect(caps?.nav.panel).toBe(true)
    expect(caps?.nav.organizaciones).toBe(false)
    expect(caps?.configuracion.tabs.impresion).toBe(false)
    expect(caps?.configuracion.tabs.apariencia).toBe(true)
    expect(caps?.onboarding.manage).toBe(false)
  })

  it('hides panel without panel:read permission', async () => {
    mockGetPermissions.mockResolvedValue(['sales:read', 'sales:write'])
    const caps = await resolveCapabilities(session({ role: 'operator', realRole: 'operator' }))
    expect(caps?.nav.panel).toBe(false)
    expect(caps?.nav.panelBranchId).toBeNull()
  })

  it('limits custom org role users to appearance in configuracion', async () => {
    mockGetPermissions.mockResolvedValue(['inventory:read', 'inventory:write', 'products:read'])
    const caps = await resolveCapabilities(session({
      role: 'operator',
      realRole: 'operator',
      orgRoleId: 'role-deposito',
    }))
    expect(caps?.nav.organizaciones).toBe(false)
    expect(caps?.nav.organizacionesHref).toBeNull()
    expect(caps?.nav.configuracion).toBe(true)
    expect(caps?.configuracion.tabs.apariencia).toBe(true)
    expect(caps?.configuracion.tabs.impresion).toBe(false)
    expect(caps?.configuracion.tabs.afip).toBe(false)
    expect(caps?.onboarding.manage).toBe(false)
  })

  it('does not grant settings UI to sys-admin while impersonating a limited user', async () => {
    mockGetPermissions.mockResolvedValue(['inventory:read', 'products:read'])
    const caps = await resolveCapabilities(session({
      role: 'operator',
      realRole: 'sys-admin',
      orgRoleId: 'role-deposito',
      impersonation: { userId: 'deposito-user', email: 'd@test.com', name: 'Depósito', role: 'operator' as UserRole },
    }))
    expect(caps?.nav.organizaciones).toBe(false)
    expect(caps?.configuracion.tabs.impresion).toBe(false)
    expect(caps?.configuracion.tabs.apariencia).toBe(true)
    expect(caps?.platform.listOrganizations).toBe(false)
  })

  it('reuses cache on repeated resolveCapabilities calls', async () => {
    const s = session()
    await resolveCapabilities(s)
    await resolveCapabilities(s)
    expect(mockGetPermissions).toHaveBeenCalledTimes(1)
  })
})
