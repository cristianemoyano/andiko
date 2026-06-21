import 'server-only'
import { cache } from 'react'
import { Op } from 'sequelize'
import RolePermission from '@/modules/auth/role-permission.model'
import PermissionModel from '@/modules/auth/permission.model'
import OrgRolePermission from '@/modules/auth/org-role-permission.model'
import type { UserRole } from '@/types/roles'

type ModuleResource = 'contacts' | 'products' | 'sales' | 'inventory' | 'purchases' | 'accounting'
type Action = 'read' | 'write' | 'delete'

export type ModulePermission = `${ModuleResource}:${Action}`
export type SettingsPermission = 'settings:read' | 'settings:write'
export type PanelPermission = 'panel:read'
export type MatrixPermission = ModulePermission | PanelPermission
export type Permission = ModulePermission | SettingsPermission | PanelPermission

const MODULE_RESOURCES: ModuleResource[] = [
  'contacts', 'products', 'sales', 'inventory', 'purchases', 'accounting',
]

export function isSettingsPermission(p: string): p is SettingsPermission {
  return p === 'settings:read' || p === 'settings:write'
}

export function isPanelPermission(p: string): p is PanelPermission {
  return p === 'panel:read'
}

export function isModulePermission(p: string): p is ModulePermission {
  const [resource, action] = p.split(':')
  return (
    MODULE_RESOURCES.includes(resource as ModuleResource) &&
    (action === 'read' || action === 'write' || action === 'delete')
  )
}

async function loadRolePermissionNames(role: UserRole, orgId?: string): Promise<string[]> {
  const where = orgId
    ? { role, [Op.or]: [{ org_id: orgId }, { org_id: null }] }
    : { role, org_id: null }

  const rows = await RolePermission.findAll({
    where,
    include: [{ model: PermissionModel, as: 'permission', attributes: ['name'] }],
  })

  const orgRows = rows.filter(r => r.org_id === orgId)
  const activeRows = orgId && orgRows.length > 0 ? orgRows : rows.filter(r => r.org_id === null)

  return activeRows
    .map(r => (r as unknown as { permission: { name: string } }).permission?.name)
    .filter((name): name is string => typeof name === 'string')
}

export const getPermissionsForRole = cache(async (
  role: UserRole,
  orgId?: string,
): Promise<Permission[]> => {
  const names = await loadRolePermissionNames(role, orgId)
  return names.filter((n): n is Permission =>
    isModulePermission(n) || isSettingsPermission(n) || isPanelPermission(n),
  )
})

export type UserPermissionIdentity = {
  role: UserRole
  orgRoleId?: string | null
}

export const getPermissionsForUser = cache(async (
  identity: UserPermissionIdentity,
  orgId?: string,
): Promise<Permission[]> => {
  if (identity.orgRoleId) {
    const rows = await OrgRolePermission.findAll({
      where: { org_role_id: identity.orgRoleId },
      include: [{ model: PermissionModel, as: 'permission', attributes: ['name'] }],
    })
    const names = rows
      .map(r => (r as unknown as { permission: { name: string } }).permission?.name)
      .filter((n): n is string => typeof n === 'string')
    return names.filter((n): n is Permission => isModulePermission(n) || isPanelPermission(n))
  }

  const perms = await getPermissionsForRole(identity.role, orgId)

  // settings:* only for built-in admin without custom org role
  if (identity.role === 'admin') {
    return perms
  }

  return perms.filter(p => !isSettingsPermission(p))
})

export async function can(
  role: UserRole,
  permission: Permission,
  orgId?: string,
  orgRoleId?: string | null,
): Promise<boolean> {
  if (role === 'sys-admin') return true
  if (isSettingsPermission(permission)) {
    if (orgRoleId) return false
    if (role !== 'admin') return false
  }
  const perms = await getPermissionsForUser({ role, orgRoleId }, orgId)
  return perms.includes(permission)
}

export async function canSettings(
  identity: UserPermissionIdentity,
  permission: SettingsPermission,
  orgId?: string,
): Promise<boolean> {
  if (identity.role === 'sys-admin') return true
  const perms = await getPermissionsForUser(identity, orgId)
  return perms.includes(permission)
}

export class ForbiddenError extends Error {
  readonly code = 'FORBIDDEN' as const
  constructor(role: UserRole, permission: Permission) {
    super(`Role '${role}' does not have permission '${permission}'`)
    this.name = 'ForbiddenError'
  }
}

export async function requirePermission(
  role: UserRole,
  permission: Permission,
  orgId?: string,
  orgRoleId?: string | null,
): Promise<void> {
  if (!(await can(role, permission, orgId, orgRoleId))) {
    throw new ForbiddenError(role, permission)
  }
}

export async function requireSettingsPermission(
  identity: UserPermissionIdentity,
  permission: SettingsPermission,
  orgId?: string,
): Promise<void> {
  if (!(await canSettings(identity, permission, orgId))) {
    throw new ForbiddenError(identity.role, permission)
  }
}

/** Assignable to custom org roles — excludes settings:* */
export const ASSIGNABLE_MODULE_PERMISSIONS: ModulePermission[] = MODULE_RESOURCES.flatMap(r =>
  (['read', 'write', 'delete'] as const).map(a => `${r}:${a}` as ModulePermission),
)

export const ASSIGNABLE_PANEL_PERMISSIONS: PanelPermission[] = ['panel:read']

export const ASSIGNABLE_MATRIX_PERMISSIONS: Permission[] = [
  ...ASSIGNABLE_PANEL_PERMISSIONS,
  ...ASSIGNABLE_MODULE_PERMISSIONS,
]
