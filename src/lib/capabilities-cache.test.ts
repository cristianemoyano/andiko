import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
import type { Session } from 'next-auth'
import {
  clearCapabilitiesCache,
  getCachedCapabilities,
  invalidateCapabilitiesForOrg,
  invalidateCapabilitiesIdentity,
  setCachedCapabilities,
} from './capabilities-cache'
import type { UiCapabilities } from '@/types/capabilities'

function makeSession(overrides: Partial<{ orgId: string | null; role: string; orgRoleId: string | null }> = {}): Session {
  return {
    expires: '2099-01-01T00:00:00.000Z',
    user: {
      id: 'user-1',
      email: 'u@test.com',
      name: 'User',
      role: (overrides.role ?? 'admin') as Session['user']['role'],
      orgId: overrides.orgId !== undefined ? overrides.orgId : 'org-1',
      branchId: null,
      orgRoleId: overrides.orgRoleId ?? null,
      actingOrgId: null,
      realRole: (overrides.role ?? 'admin') as Session['user']['role'],
      realOrgId: overrides.orgId !== undefined ? overrides.orgId : 'org-1',
      realBranchId: null,
      impersonation: null,
    },
  }
}

const sampleCaps = {
  permissions: [],
  settingsPermissions: [],
  platform: { listOrganizations: false, sysAdminEmail: false, impersonation: false },
  nav: { panel: true, panelBranchId: null, organizaciones: true, organizacionesHref: '/organizaciones/org-1', configuracion: true },
  organizacion: {
    detail: true,
    apiNamespace: 'settings' as const,
    sections: {
      fiscal: true,
      fiscalEdit: true,
      orgMetaEdit: false,
      deleteOrg: false,
      enabledModules: false,
      users: true,
      branches: true,
      rolesMatrix: true,
    },
    actions: {
      createUser: true,
      editUser: true,
      deleteUser: true,
      createBranch: true,
      editBranch: true,
      deleteBranch: true,
      saveRolesMatrix: true,
    },
  },
  configuracion: {
    tabs: {
      impresion: true,
      plantillasEmail: true,
      emailsEnviados: true,
      apariencia: true,
      afip: true,
    },
  },
} satisfies UiCapabilities

beforeEach(() => {
  clearCapabilitiesCache()
})

describe('capabilities-cache', () => {
  it('returns cached value for same session identity', () => {
    const session = makeSession()
    setCachedCapabilities(session, 'org-1', 'admin', null, sampleCaps)
    expect(getCachedCapabilities(session, 'org-1', 'admin', null)).toEqual(sampleCaps)
  })

  it('invalidates org-scoped entries when org generation bumps', () => {
    const session = makeSession()
    setCachedCapabilities(session, 'org-1', 'admin', null, sampleCaps)
    invalidateCapabilitiesForOrg('org-1')
    expect(getCachedCapabilities(session, 'org-1', 'admin', null)).toBeNull()
  })

  it('invalidates identity-scoped entries without affecting other roles in same org', () => {
    const adminSession = makeSession({ role: 'admin' })
    const operatorSession = makeSession({ role: 'operator' })
    setCachedCapabilities(adminSession, 'org-1', 'admin', null, sampleCaps)
    setCachedCapabilities(operatorSession, 'org-1', 'operator', null, sampleCaps)

    invalidateCapabilitiesIdentity('org-1', 'admin', null)

    expect(getCachedCapabilities(adminSession, 'org-1', 'admin', null)).toBeNull()
    expect(getCachedCapabilities(operatorSession, 'org-1', 'operator', null)).toEqual(sampleCaps)
  })

  it('invalidates custom org role identities independently', () => {
    const session = makeSession({ role: 'operator', orgRoleId: 'role-custom' })
    setCachedCapabilities(session, 'org-1', 'operator', 'role-custom', sampleCaps)
    invalidateCapabilitiesIdentity('org-1', 'operator', 'role-custom')
    expect(getCachedCapabilities(session, 'org-1', 'operator', 'role-custom')).toBeNull()
  })
})
