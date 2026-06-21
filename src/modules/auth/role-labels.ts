import type { ModulePermission } from '@/lib/permissions'
import type { UserRole } from '@/types/roles'

/** Built-in roles that can be assigned when creating users (ERP job functions use custom org roles). */
export type AssignableBuiltinRole = 'admin' | 'branch-admin'

export const ASSIGNABLE_BUILTIN_ROLES: AssignableBuiltinRole[] = ['admin', 'branch-admin']

/** Built-in columns shown in the permission matrix (reference defaults). */
export const BUILTIN_MATRIX_ROLES: UserRole[] = ['admin', 'branch-admin', 'readonly']

export const BUILTIN_ROLE_LABEL: Record<UserRole, string | null> = {
  'sys-admin': 'Sys-admin',
  admin: 'Gerente',
  operator: 'Operativo',
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
