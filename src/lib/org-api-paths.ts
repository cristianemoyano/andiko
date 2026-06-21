export type OrgApiNamespace = 'sys-admin' | 'settings'

export function orgApiPaths(apiNamespace: OrgApiNamespace, orgId: string) {
  if (apiNamespace === 'sys-admin') {
    return {
      organization: `/api/v1/sys-admin/organizations/${orgId}`,
      users: `/api/v1/sys-admin/organizations/${orgId}/users`,
      user: (userId: string) => `/api/v1/sys-admin/organizations/${orgId}/users/${userId}`,
      branches: `/api/v1/sys-admin/organizations/${orgId}/branches`,
      branch: (branchId: string) => `/api/v1/sys-admin/branches/${branchId}`,
      settings: `/api/v1/sys-admin/organizations/${orgId}/settings`,
      rolesMatrix: `/api/v1/settings/roles/matrix`,
      roles: `/api/v1/settings/roles`,
      role: (roleId: string) => `/api/v1/settings/roles/${roleId}`,
    } as const
  }

  return {
    organization: `/api/v1/settings/organization`,
    users: `/api/v1/settings/users`,
    user: (userId: string) => `/api/v1/settings/users/${userId}`,
    branches: `/api/v1/settings/branches`,
    branch: (branchId: string) => `/api/v1/settings/branches/${branchId}`,
    settings: null,
    rolesMatrix: `/api/v1/settings/roles/matrix`,
    roles: `/api/v1/settings/roles`,
    role: (roleId: string) => `/api/v1/settings/roles/${roleId}`,
  } as const
}
