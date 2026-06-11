// Catálogo de módulos del ERP y mapa base vs premium.
// Client-safe: no importa sequelize ni código server-only.

export const ORG_MODULE_KEYS = [
  'contacts',
  'catalog',
  'sales',
  'inventory',
  'purchases',
  'accounting',
  'pos',
] as const

export type OrgModuleKey = typeof ORG_MODULE_KEYS[number]

export type OrgModuleTier = 'base' | 'premium'

export interface OrgModuleDef {
  key: OrgModuleKey
  label: string
  tier: OrgModuleTier
}

export const ORG_MODULE_DEFS: OrgModuleDef[] = [
  { key: 'contacts', label: 'Contactos', tier: 'base' },
  { key: 'catalog', label: 'Catálogo', tier: 'base' },
  { key: 'sales', label: 'Ventas', tier: 'base' },
  { key: 'inventory', label: 'Inventario', tier: 'premium' },
  { key: 'purchases', label: 'Compras', tier: 'premium' },
  { key: 'accounting', label: 'Contabilidad', tier: 'premium' },
  { key: 'pos', label: 'POS (punto de venta)', tier: 'premium' },
]

// Las orgs existentes operan con todo habilitado: cuando una org no tiene fila
// en organization_settings (o enabled_modules es null), aplican estos defaults.
export const DEFAULT_ENABLED_MODULES: OrgModuleKey[] = [...ORG_MODULE_KEYS]

// Recurso de permiso (`sales:read` → `sales`) → módulo que lo gobierna.
export const PERMISSION_RESOURCE_TO_MODULE: Record<string, OrgModuleKey> = {
  contacts: 'contacts',
  products: 'catalog',
  sales: 'sales',
  inventory: 'inventory',
  purchases: 'purchases',
  accounting: 'accounting',
}

export function isOrgModuleKey(value: string): value is OrgModuleKey {
  return (ORG_MODULE_KEYS as readonly string[]).includes(value)
}
