import { describe, it, expect } from 'vitest'
import {
  hasPanelAccess,
  isPathModuleAccessible,
  resolveDefaultLandingPath,
  resolveModuleAccessRedirect,
  SIN_ACCESO_PATH,
} from '@/lib/panel-access'
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
    integraciones: false,
    ...overrides,
  },
  integraciones: {
    read: false,
    write: false,
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
      integraciones: false,
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

describe('isPathModuleAccessible()', () => {
  it('allows unguarded ERP paths', () => {
    expect(isPathModuleAccessible('/panel', ['sales'], ['sales:read'])).toBe(true)
    expect(isPathModuleAccessible('/configuracion', ['sales'], ['sales:read'])).toBe(true)
  })

  it('blocks module paths without read permission', () => {
    expect(isPathModuleAccessible('/ventas', ['sales'], ['inventory:read'])).toBe(false)
    expect(isPathModuleAccessible('/inventario', ['inventory'], ['inventory:read'])).toBe(true)
  })

  it('blocks disabled modules for the org', () => {
    expect(isPathModuleAccessible('/inventario', ['sales'], ['inventory:read'])).toBe(false)
  })
})

describe('resolveModuleAccessRedirect()', () => {
  it('redirects to another accessible module without query params', () => {
    const caps = baseCaps()
    expect(resolveModuleAccessRedirect('/inventario', caps, ['sales', 'inventory'], 'forbidden'))
      .toBe('/ventas')
  })

  it('redirects to configuracion when no module is accessible', () => {
    const caps = baseCaps()
    caps.permissions = []
    expect(resolveModuleAccessRedirect('/ventas', caps, ['sales'], 'forbidden'))
      .toBe('/configuracion')
  })

  it('redirects to sin-acceso when the landing path would repeat the blocked route', () => {
    const caps = baseCaps()
    expect(resolveModuleAccessRedirect('/ventas', caps, ['sales', 'contacts'], 'forbidden'))
      .toBe(`${SIN_ACCESO_PATH}?reason=forbidden`)
  })

  it('keeps sin-acceso stable', () => {
    const caps = baseCaps()
    expect(resolveModuleAccessRedirect(SIN_ACCESO_PATH, caps, ['sales'], 'forbidden'))
      .toBe(SIN_ACCESO_PATH)
  })
})
