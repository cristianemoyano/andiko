import type { UiCapabilities } from '@/types/capabilities'

/** Default capabilities for Storybook / isolated component renders. */
export const storyCapabilities: UiCapabilities = {
  permissions: ['sales:read', 'contacts:read'],
  settingsPermissions: [],
  platform: {
    listOrganizations: false,
    sysAdminEmail: false,
    impersonation: false,
  },
  nav: {
    panel: true,
    panelBranchId: null,
    organizaciones: false,
    organizacionesHref: null,
    configuracion: true,
    facturacion: false,
    integraciones: false,
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
      impresion: true,
      plantillasEmail: false,
      emailsEnviados: false,
      apariencia: true,
      afip: false,
      integraciones: false,
      terminosCondiciones: true,
      alertas: false,
    },
  },
  onboarding: {
    manage: false,
  },
}
