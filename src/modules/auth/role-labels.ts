import type { ModulePermission } from '@/lib/permissions'
import type { UserRole } from '@/types/roles'

/** Built-in roles that can be assigned when creating users (ERP job functions use custom org roles). */
export type AssignableBuiltinRole = 'admin' | 'branch-admin'

export const ASSIGNABLE_BUILTIN_ROLES: AssignableBuiltinRole[] = ['admin', 'branch-admin']

/** DB `users.role` for custom org roles (Vendedor, Contador, etc.). Not shown as "Operativo" in UI. */
export const CUSTOM_ORG_ROLE_CARRIER: UserRole = 'operator'

/** Built-in roles deprecated for new users; kept for existing rows and update flows. */
export const LEGACY_BUILTIN_ROLES = ['operator'] as const
export type LegacyBuiltinRole = (typeof LEGACY_BUILTIN_ROLES)[number]

export function isLegacyBuiltinRole(role: UserRole | string): role is LegacyBuiltinRole {
  return (LEGACY_BUILTIN_ROLES as readonly string[]).includes(role)
}

export function isCustomOrgRoleCarrier(
  role: UserRole | string,
  orgRoleId: string | null | undefined,
): boolean {
  return role === CUSTOM_ORG_ROLE_CARRIER && !!orgRoleId
}

/** Standalone legacy Operativo (`operator` without `org_role_id`). */
export function isStandaloneLegacyOperator(
  role: UserRole | string,
  orgRoleId: string | null | undefined,
): boolean {
  return role === CUSTOM_ORG_ROLE_CARRIER && !orgRoleId
}

/** Built-in columns shown in the permission matrix (reference defaults). */
export const BUILTIN_MATRIX_ROLES: UserRole[] = ['admin', 'branch-admin', 'readonly']

export const BUILTIN_ROLE_LABEL: Record<UserRole, string | null> = {
  'sys-admin': 'Sys-admin',
  admin: 'Gerente',
  operator: 'Operativo (legacy)',
  readonly: 'Solo lectura',
  'branch-admin': 'Encargado de sucursal',
}

export type DefaultOrgRoleTemplate = {
  name: string
  description: string
  allows_pos: boolean
  permissions: ModulePermission[]
}

/** Seeded as custom org roles when an organization is created. */
export const DEFAULT_ORG_ROLE_TEMPLATES: DefaultOrgRoleTemplate[] = [
  {
    name: 'Vendedor',
    description: 'Presupuestos, facturas, clientes y consulta de stock',
    allows_pos: true,
    permissions: [
      'contacts:read',
      'contacts:write',
      'sales:read',
      'sales:write',
      'products:read',
      'inventory:read',
    ],
  },
  {
    name: 'Cajero',
    description: 'Ventas en punto de venta, cobros y consulta de catálogo',
    allows_pos: true,
    permissions: [
      'contacts:read',
      'sales:read',
      'sales:write',
      'products:read',
      'inventory:read',
    ],
  },
  {
    name: 'Gerente de compras',
    description: 'Órdenes de compra, proveedores y recepción',
    allows_pos: false,
    permissions: [
      'contacts:read',
      'contacts:write',
      'purchases:read',
      'purchases:write',
      'inventory:read',
      'inventory:write',
      'products:read',
    ],
  },
  {
    name: 'Contador',
    description: 'Contabilidad, reportes e impuestos',
    allows_pos: false,
    permissions: [
      'accounting:read',
      'accounting:write',
      'sales:read',
      'purchases:read',
      'contacts:read',
    ],
  },
  {
    name: 'Depósito',
    description: 'Movimientos de stock, remitos e inventario',
    allows_pos: false,
    permissions: [
      'inventory:read',
      'inventory:write',
      'products:read',
    ],
  },
]

export function getBuiltinRoleLabel(role: UserRole | string): string {
  const label = BUILTIN_ROLE_LABEL[role as UserRole]
  return label ?? role
}

export function isAssignableBuiltinRole(role: string): role is AssignableBuiltinRole {
  return (ASSIGNABLE_BUILTIN_ROLES as readonly string[]).includes(role)
}

/** Human-readable role for UI (org role name when set, else built-in label). */
export function resolveUserRoleLabel(
  builtinRole: UserRole | string,
  orgRoleName?: string | null,
): string {
  if (orgRoleName) return orgRoleName
  const label = BUILTIN_ROLE_LABEL[builtinRole as UserRole]
  return label ?? String(builtinRole)
}

export function resolveUserRoleBadgeStatus(
  role: UserRole | string,
  orgRoleId: string | null | undefined,
): 'info' | 'success' | 'pending' | 'neutral' {
  if (isStandaloneLegacyOperator(role, orgRoleId)) return 'neutral'
  if (role === 'sys-admin') return 'info'
  if (role === 'admin' || role === 'branch-admin') return 'success'
  if (role === 'readonly') return 'neutral'
  return 'neutral'
}
