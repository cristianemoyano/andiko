import type { Permission, SettingsPermission } from '@/lib/permissions'

export type UiCapabilities = {
  permissions: Permission[]
  settingsPermissions: SettingsPermission[]
  platform: {
    listOrganizations: boolean
    sysAdminEmail: boolean
    impersonation: boolean
  }
  nav: {
    panel: boolean
    /** Sucursal fija para Encargado de sucursal; null = Gerente ve todas */
    panelBranchId: string | null
    organizaciones: boolean
    organizacionesHref: string | null
    configuracion: boolean
    /** Panel de facturación de la propia organización (Gerente); no para sys-admin de plataforma. */
    facturacion: boolean
    /** Integraciones de canal (WooCommerce, etc.) con org en contexto. */
    integraciones: boolean
  }
  integraciones: {
    read: boolean
    write: boolean
  }
  organizacion: {
    detail: boolean
    apiNamespace: 'sys-admin' | 'settings'
    sections: {
      fiscal: boolean
      fiscalEdit: boolean
      orgMetaEdit: boolean
      deleteOrg: boolean
      enabledModules: boolean
      users: boolean
      branches: boolean
      rolesMatrix: boolean
    }
    actions: {
      createUser: boolean
      editUser: boolean
      deleteUser: boolean
      createBranch: boolean
      editBranch: boolean
      deleteBranch: boolean
      saveRolesMatrix: boolean
    }
  }
  configuracion: {
    tabs: {
      impresion: boolean
      plantillasEmail: boolean
      emailsEnviados: boolean
      apariencia: boolean
      afip: boolean
      integraciones: boolean
    }
  }
  /** Configuración inicial de la org (wizard). Mismo alcance que settings:write. */
  onboarding: {
    manage: boolean
  }
}
