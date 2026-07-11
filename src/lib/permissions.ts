import 'server-only'
import { cache } from 'react'
import { Op } from 'sequelize'
import RolePermission from '@/modules/auth/role-permission.model'
import PermissionModel from '@/modules/auth/permission.model'
import OrgRolePermission from '@/modules/auth/org-role-permission.model'
import { currentGlobalGeneration, currentOrgGeneration } from '@/lib/capabilities-cache'
import type { UserRole } from '@/types/roles'

type ModuleResource = 'contacts' | 'products' | 'sales' | 'inventory' | 'purchases' | 'accounting' | 'logistics' | 'automations'
type Action = 'read' | 'write' | 'delete'

export type ModulePermission = `${ModuleResource}:${Action}`
export type SettingsPermission = 'settings:read' | 'settings:write'
export type PanelPermission = 'panel:read'
export type SalesScopePermission = 'sales:scope_own'
export type LogisticsScopePermission = 'logistics:scope_assigned'
export type MatrixPermission = ModulePermission | PanelPermission | SalesScopePermission | LogisticsScopePermission
export type Permission = ModulePermission | SettingsPermission | PanelPermission | SalesScopePermission | LogisticsScopePermission

const MODULE_RESOURCES: ModuleResource[] = [
  'contacts', 'products', 'sales', 'inventory', 'purchases', 'accounting', 'logistics', 'automations',
]

export function isSettingsPermission(p: string): p is SettingsPermission {
  return p === 'settings:read' || p === 'settings:write'
}

export function isPanelPermission(p: string): p is PanelPermission {
  return p === 'panel:read'
}

export function isSalesScopePermission(p: string): p is SalesScopePermission {
  return p === 'sales:scope_own'
}

export function hasSalesScopeOwn(permissions: readonly string[]): boolean {
  return permissions.includes('sales:scope_own')
}

export function isLogisticsScopePermission(p: string): p is LogisticsScopePermission {
  return p === 'logistics:scope_assigned'
}

export function hasLogisticsScopeAssigned(permissions: readonly string[]): boolean {
  return permissions.includes('logistics:scope_assigned')
}

export function isModulePermission(p: string): p is ModulePermission {
  const [resource, action] = p.split(':')
  return (
    MODULE_RESOURCES.includes(resource as ModuleResource) &&
    (action === 'read' || action === 'write' || action === 'delete')
  )
}

/** Built-in roles that always have panel access (not configurable in the roles matrix). */
export const BUILTIN_PANEL_ROLES = ['admin', 'branch-admin'] as const satisfies readonly UserRole[]

function withBuiltinPanelAccess(role: UserRole, perms: Permission[]): Permission[] {
  if (!(BUILTIN_PANEL_ROLES as readonly UserRole[]).includes(role)) return perms
  return perms.includes('panel:read') ? perms : [...perms, 'panel:read']
}

// Process-level cache for permission lookups, gated on the same generation counters that
// `capabilities-cache.ts` bumps at every role_permissions / org_role_permissions mutation
// site. `cache()` (React) only dedupes within a single request; this survives across
// requests within the same server instance, cutting the DB round trip most of them would
// otherwise pay.
const MAX_PERMISSION_CACHE_ENTRIES = 1000

type RolePermCacheEntry = { value: string[]; globalGen: number; orgGen: number }
const rolePermCache = new Map<string, RolePermCacheEntry>()

type OrgRolePermCacheEntry = { value: string[]; orgGen: number }
const orgRolePermCache = new Map<string, OrgRolePermCacheEntry>()

function trimCache(store: Map<string, unknown>): void {
  while (store.size > MAX_PERMISSION_CACHE_ENTRIES) {
    const oldest = store.keys().next().value
    if (oldest === undefined) break
    store.delete(oldest)
  }
}

/** Test helper — clears the process-level permission caches. */
export function clearPermissionCache(): void {
  rolePermCache.clear()
  orgRolePermCache.clear()
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
  const key = `${role}|${orgId ?? '_'}`
  const globalGen = currentGlobalGeneration()
  const orgGen = currentOrgGeneration(orgId ?? null)
  const cached = rolePermCache.get(key)
  if (cached && cached.globalGen === globalGen && cached.orgGen === orgGen) {
    return cached.value as Permission[]
  }

  const names = await loadRolePermissionNames(role, orgId)
  const perms = withBuiltinPanelAccess(
    role,
    names.filter((n): n is Permission =>
      isModulePermission(n) || isSettingsPermission(n) || isPanelPermission(n) || isSalesScopePermission(n) || isLogisticsScopePermission(n),
    ),
  )
  rolePermCache.set(key, { value: perms, globalGen, orgGen })
  trimCache(rolePermCache)
  return perms
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
    // Keyed by org_role_id: the permission set assigned to a custom role is org-wide, mutated
    // only via updateOrgRolesMatrix/deleteOrgRole/etc, all of which bump this org's generation.
    const orgGen = currentOrgGeneration(orgId ?? null)
    const cached = orgRolePermCache.get(identity.orgRoleId)
    if (cached && cached.orgGen === orgGen) {
      return cached.value as Permission[]
    }

    const rows = await OrgRolePermission.findAll({
      where: { org_role_id: identity.orgRoleId },
      include: [{ model: PermissionModel, as: 'permission', attributes: ['name'] }],
    })
    const names = rows
      .map(r => (r as unknown as { permission: { name: string } }).permission?.name)
      .filter((n): n is string => typeof n === 'string')
    const perms = names.filter((n): n is Permission =>
      isModulePermission(n) || isPanelPermission(n) || isSalesScopePermission(n) || isLogisticsScopePermission(n),
    )
    orgRolePermCache.set(identity.orgRoleId, { value: perms, orgGen })
    trimCache(orgRolePermCache)
    return perms
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

export const ASSIGNABLE_SALES_SCOPE_PERMISSIONS: SalesScopePermission[] = ['sales:scope_own']

export const ASSIGNABLE_LOGISTICS_SCOPE_PERMISSIONS: LogisticsScopePermission[] = ['logistics:scope_assigned']

export const ASSIGNABLE_MATRIX_PERMISSIONS: Permission[] = [
  ...ASSIGNABLE_PANEL_PERMISSIONS,
  ...ASSIGNABLE_SALES_SCOPE_PERMISSIONS,
  ...ASSIGNABLE_LOGISTICS_SCOPE_PERMISSIONS,
  ...ASSIGNABLE_MODULE_PERMISSIONS,
]
