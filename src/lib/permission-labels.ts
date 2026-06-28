const MODULE_LABELS: Record<string, string> = {
  contacts: 'Contactos',
  products: 'Productos',
  sales: 'Ventas',
  inventory: 'Inventario',
  purchases: 'Compras',
  accounting: 'Contabilidad',
}

const ACTION_LABELS: Record<string, string> = {
  read: 'Leer',
  write: 'Escribir',
  delete: 'Eliminar',
}

const SPECIAL_PERMISSION_LABELS: Record<string, string> = {
  'panel:read': 'Panel · Ver',
  'sales:scope_own': 'Ventas · Solo propias',
}

/** Human-readable label for matrix permissions (client + server). */
export function permissionDisplayLabel(name: string): string {
  const special = SPECIAL_PERMISSION_LABELS[name]
  if (special) return special

  const [resource, action] = name.split(':')
  return `${MODULE_LABELS[resource] ?? resource} · ${ACTION_LABELS[action] ?? action}`
}

/** Preferred row order within the Ventas module filter. */
export const SALES_PERMISSION_ORDER = [
  'sales:read',
  'sales:write',
  'sales:delete',
  'sales:scope_own',
] as const

export function sortPermissionsForGroup<T extends { name: string }>(group: string, perms: T[]): T[] {
  if (group !== 'sales') return perms
  const order = SALES_PERMISSION_ORDER as readonly string[]
  return [...perms].sort((a, b) => {
    const ai = order.indexOf(a.name)
    const bi = order.indexOf(b.name)
    if (ai === -1 && bi === -1) return a.name.localeCompare(b.name)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}
