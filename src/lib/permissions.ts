import 'server-only'
import { cache } from 'react'
import { Op } from 'sequelize'
import RolePermission from '@/modules/auth/role-permission.model'
import PermissionModel from '@/modules/auth/permission.model'
import type { UserRole } from '@/types/roles'

// ── Permission types ──────────────────────────────────────────────────────────
// To add a new module: extend Resource. TypeScript auto-generates all action variants.

type Resource = 'contacts' | 'products' | 'sales' | 'inventory' | 'purchases' | 'accounting'
type Action   = 'read' | 'write' | 'delete'

export type Permission = `${Resource}:${Action}`

// ── DB loader ─────────────────────────────────────────────────────────────────
// React cache() deduplicates within the same request — one DB hit per request.
// Org-specific rows override global defaults (org_id = NULL).
// If an org has any override rows, only those rows apply for that org+role combo.

export const getPermissionsForRole = cache(async (
  role: UserRole,
  orgId?: string,
): Promise<Permission[]> => {
  const where = orgId
    ? { role, [Op.or]: [{ org_id: orgId }, { org_id: null }] }
    : { role, org_id: null }

  const rows = await RolePermission.findAll({
    where,
    include: [{ model: PermissionModel, as: 'permission', attributes: ['name'] }],
  })

  // If org has specific overrides, use only those. Otherwise use global defaults.
  const orgRows    = rows.filter(r => r.org_id === orgId)
  const activeRows = orgId && orgRows.length > 0 ? orgRows : rows.filter(r => r.org_id === null)

  return activeRows
    .map(r => (r as unknown as { permission: { name: string } }).permission?.name)
    .filter((name): name is Permission => typeof name === 'string')
})

// ── Helpers ───────────────────────────────────────────────────────────────────

export async function can(
  role: UserRole,
  permission: Permission,
  orgId?: string,
): Promise<boolean> {
  if (role === 'sys-admin') return true
  const perms = await getPermissionsForRole(role, orgId)
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
): Promise<void> {
  if (!(await can(role, permission, orgId))) {
    throw new ForbiddenError(role, permission)
  }
}
