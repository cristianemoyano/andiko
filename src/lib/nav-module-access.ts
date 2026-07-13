import { NAV_ID_TO_MODULE, type OrgModuleKey } from '@/modules/auth/organization-modules'

/** Permiso mínimo de lectura por módulo de org (para nav). POS usa ventas como proxy. */
const MODULE_READ_PERMISSION: Record<OrgModuleKey, string> = {
  contacts: 'contacts',
  catalog: 'products',
  sales: 'sales',
  inventory: 'inventory',
  purchases: 'purchases',
  accounting: 'accounting',
  pos: 'sales',
  automations: 'automations',
  hr: 'attendance',
  production: 'production',
}

export function hasLogisticsReadAccess(permissions: readonly string[]): boolean {
  return permissions.includes('logistics:read') || permissions.includes('sales:read')
}

export function hasModuleReadAccess(moduleKey: OrgModuleKey, permissions: readonly string[]): boolean {
  const resource = MODULE_READ_PERMISSION[moduleKey]
  return permissions.some(p => {
    const [permResource] = p.split(':')
    return permResource === resource
  })
}

export function isModuleNavVisible(
  navId: string,
  enabledModules: OrgModuleKey[] | undefined,
  permissions: readonly string[] | undefined,
): boolean {
  const moduleKey = NAV_ID_TO_MODULE[navId]

  if (enabledModules && moduleKey && !enabledModules.includes(moduleKey)) {
    return false
  }

  if (!moduleKey) return true

  if (!permissions) return false

  if (navId === 'logistica') return hasLogisticsReadAccess(permissions)

  return hasModuleReadAccess(moduleKey, permissions)
}
