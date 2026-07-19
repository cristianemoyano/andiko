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
  'automations',
  'expenses',
  'hr',
  'campaigns',
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
  { key: 'automations', label: 'Automatizaciones', tier: 'premium' },
  { key: 'expenses', label: 'Expensas', tier: 'premium' },
  { key: 'hr', label: 'Recursos Humanos', tier: 'premium' },
  { key: 'campaigns', label: 'Campañas', tier: 'premium' },
]

/** Módulos incluidos en plan base (sin premium). */
export const BASE_TIER_MODULES: OrgModuleKey[] = ORG_MODULE_DEFS
  .filter(d => d.tier === 'base')
  .map(d => d.key)

/** Defaults para orgs nuevas o sin fila en organization_settings. */
export const DEFAULT_ENABLED_MODULES: OrgModuleKey[] = [...ORG_MODULE_KEYS]

/** Defaults para orgs con plan base (Premium SA en seed). */
export const BASE_PLAN_ENABLED_MODULES: OrgModuleKey[] = [...BASE_TIER_MODULES]

/** Prefijos de ruta ERP → módulo (orden: más específico primero). */
export const ROUTE_PREFIX_TO_MODULE: ReadonlyArray<{ prefix: string; module: OrgModuleKey }> = [
  { prefix: '/ventas/libro-iva', module: 'accounting' },
  { prefix: '/ventas/reportes', module: 'accounting' },
  { prefix: '/compras/libro-iva', module: 'accounting' },
  { prefix: '/compras/reportes', module: 'accounting' },
  { prefix: '/ventas', module: 'sales' },
  { prefix: '/logistica', module: 'sales' },
  { prefix: '/inventario', module: 'inventory' },
  { prefix: '/compras', module: 'purchases' },
  { prefix: '/contabilidad', module: 'accounting' },
  { prefix: '/contactos', module: 'contacts' },
  { prefix: '/catalogo', module: 'catalog' },
  { prefix: '/pos', module: 'pos' },
  { prefix: '/automatizaciones', module: 'automations' },
  { prefix: '/expensas', module: 'expenses' },
  { prefix: '/control-horario', module: 'hr' },
  { prefix: '/campanas', module: 'campaigns' },
]

/** Sidebar nav id → module key */
export const NAV_ID_TO_MODULE: Record<string, OrgModuleKey> = {
  ventas: 'sales',
  // Logística MVP: vive dentro del módulo de ventas (fulfillment de pedidos).
  logistica: 'sales',
  inventario: 'inventory',
  compras: 'purchases',
  contabilidad: 'accounting',
  contactos: 'contacts',
  catalogo: 'catalog',
  'pos-dispositivos': 'pos',
  'pos-cajas': 'pos',
  'pos-medios-de-pago': 'pos',
  automatizaciones: 'automations',
  expensas: 'expenses',
  'control-horario': 'hr',
  campanas: 'campaigns',
}

export function resolveModuleForPath(pathname: string): OrgModuleKey | null {
  for (const { prefix, module } of ROUTE_PREFIX_TO_MODULE) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return module
  }
  return null
}

export function getDefaultModulesForPlan(plan: 'full' | 'base'): OrgModuleKey[] {
  return plan === 'base' ? [...BASE_PLAN_ENABLED_MODULES] : [...DEFAULT_ENABLED_MODULES]
}

// Recurso de permiso (`sales:read` → `sales`) → módulo que lo gobierna.
export const PERMISSION_RESOURCE_TO_MODULE: Record<string, OrgModuleKey> = {
  contacts: 'contacts',
  products: 'catalog',
  sales: 'sales',
  inventory: 'inventory',
  purchases: 'purchases',
  accounting: 'accounting',
  pos: 'pos',
  automations: 'automations',
  expenses: 'expenses',
  employees: 'hr',
  attendance: 'hr',
  campaigns: 'campaigns',
}

export function isOrgModuleKey(value: string): value is OrgModuleKey {
  return (ORG_MODULE_KEYS as readonly string[]).includes(value)
}
