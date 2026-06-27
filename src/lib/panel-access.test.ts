import { describe, it, expect } from 'vitest'
import { hasPanelAccess, resolveDefaultLandingPath } from '@/lib/panel-access'
import type { UiCapabilities } from '@/types/capabilities'

const baseCaps = (overrides: Partial<UiCapabilities['nav']> = {}): UiCapabilities => ({
  permissions: ['sales:read'],
  settingsPermissions: [],
  platform: { listOrganizations: false, sysAdminEmail: false, impersonation: false },
  nav: {
    panel: false,
    panelBranchId: null,
    organizaciones: false,
    organizacionesHref: null,
    configuracion: true,
    facturacion: false,
    ...overrides,
  },
  organizacion: {
    detail: false,
    apiNamespace: 'settings',
    sections: {
      fiscal: false,
      fiscalEdit: false,
      orgMetaEdit: false,
      deleteOrg: false,
      enabledModules: false,
      users: false,
      branches: false,
      rolesMatrix: false,
    },
    actions: {
      createUser: false,
      editUser: false,
      deleteUser: false,
      createBranch: false,
      editBranch: false,
      deleteBranch: false,
      saveRolesMatrix: false,
    },
  },
  configuracion: {
    tabs: {
      impresion: false,
      plantillasEmail: false,
      emailsEnviados: false,
      apariencia: true,
      afip: false,
    },
  },
  onboarding: {
    manage: false,
  },
})

describe('hasPanelAccess()', () => {
  it('returns true when panel:read is granted', () => {
    expect(hasPanelAccess(['panel:read'])).toBe(true)
    expect(hasPanelAccess(['panel:read', 'sales:read'])).toBe(true)
  })

  it('returns false without panel:read', () => {
    expect(hasPanelAccess(['sales:read'])).toBe(false)
    expect(hasPanelAccess([])).toBe(false)
  })
})

describe('resolveDefaultLandingPath()', () => {
  it('returns panel when user has panel access', () => {
    const caps = baseCaps({ panel: true })
    expect(resolveDefaultLandingPath(caps, ['sales'])).toBe('/panel')
  })

  it('returns first enabled module with permission for non-panel users', () => {
    const caps = baseCaps()
    expect(resolveDefaultLandingPath(caps, ['sales', 'contacts'])).toBe('/ventas')
  })

  it('falls back to configuracion when no module matches', () => {
    const caps = baseCaps({ configuracion: false })
    caps.permissions = []
    expect(resolveDefaultLandingPath(caps, ['sales'])).toBe('/configuracion')
  })
})
