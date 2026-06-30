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

/** Qué habilita cada permiso en la matriz (alcance funcional). */
const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  'panel:read': 'Panel ejecutivo, KPIs y alertas de stock.',

  'contacts:read': 'Ver clientes, proveedores y direcciones.',
  'contacts:write': 'Crear y editar contactos.',
  'contacts:delete': 'Eliminar contactos.',

  'products:read': 'Catálogo, categorías, listas de precios e importación.',
  'products:write': 'Crear y editar productos, precios e importar catálogo.',
  'products:delete': 'Eliminar productos del catálogo.',

  'sales:read': 'Presupuestos, pedidos, facturas, cobros y devoluciones.',
  'sales:write': 'Crear y editar documentos de venta, cobrar y anular.',
  'sales:delete': 'Eliminar presupuestos y pedidos en borrador.',
  'sales:scope_own': 'Limita ventas a documentos del vendedor logueado.',

  'inventory:read': 'Depósitos, stock, movimientos, transferencias (consulta), reposición y remitos.',
  'inventory:write': 'Ajustes de stock, transferencias, mínimos/alertas, remitos y stock default por depósito.',
  'inventory:delete': 'Eliminar depósitos.',

  'purchases:read': 'Órdenes de compra, recepciones, facturas de proveedor y pagos.',
  'purchases:write': 'Crear y editar compras, recepcionar mercadería y registrar pagos.',
  'purchases:delete': 'Eliminar órdenes de compra en borrador.',

  'accounting:read': 'Plan de cuentas, asientos, libros e informes.',
  'accounting:write': 'Crear asientos y configurar contabilidad.',
  'accounting:delete': 'Eliminar asientos en borrador.',
}

/** Human-readable label for matrix permissions (client + server). */
export function permissionDisplayLabel(name: string): string {
  const special = SPECIAL_PERMISSION_LABELS[name]
  if (special) return special

  const [resource, action] = name.split(':')
  return `${MODULE_LABELS[resource] ?? resource} · ${ACTION_LABELS[action] ?? action}`
}

/** Alcance funcional mostrado en la matriz de permisos. */
export function permissionDescription(name: string): string {
  return PERMISSION_DESCRIPTIONS[name] ?? ''
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
