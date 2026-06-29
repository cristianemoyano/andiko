import { NAV_MODULES } from '@/components/layout/nav-items'
import { resolveModuleForPath, type OrgModuleKey } from '@/modules/auth/organization-modules'
import type { Permission } from '@/lib/permissions'
import type { UiCapabilities } from '@/types/capabilities'
import { hasModuleReadAccess, isModuleNavVisible } from '@/lib/nav-module-access'

export const SIN_ACCESO_PATH = '/sin-acceso' as const

export type ModuleAccessDenialReason = 'disabled' | 'forbidden'

export function hasPanelAccess(permissions: readonly Permission[]): boolean {
  return permissions.includes('panel:read')
}

/** Whether a module-guarded ERP path is enabled for the org and readable by the user. */
export function isPathModuleAccessible(
  pathname: string,
  enabledModules: OrgModuleKey[] | undefined,
  permissions: readonly string[] | undefined,
): boolean {
  const moduleForPath = resolveModuleForPath(pathname)
  if (!moduleForPath) return true
  if (enabledModules && !enabledModules.includes(moduleForPath)) return false
  if (!permissions) return false
  return hasModuleReadAccess(moduleForPath, permissions)
}

/** Primera pantalla útil cuando el usuario no tiene acceso al panel. */
export function resolveDefaultLandingPath(
  caps: UiCapabilities | null,
  enabledModules?: OrgModuleKey[],
): string {
  if (caps?.nav.panel) return '/panel'

  for (const item of NAV_MODULES) {
    if (isModuleNavVisible(item.id, enabledModules, caps?.permissions)) {
      return item.href
    }
  }

  if (caps?.nav.configuracion) return '/configuracion'
  return '/configuracion'
}

/**
 * Safe redirect target when the current module path is disabled or forbidden.
 * Prefers a different accessible landing page; otherwise `/sin-acceso` with reason.
 */
export function resolveModuleAccessRedirect(
  pathname: string,
  caps: UiCapabilities | null,
  enabledModules: OrgModuleKey[] | undefined,
  denialReason: ModuleAccessDenialReason,
): string {
  if (pathname === SIN_ACCESO_PATH) return SIN_ACCESO_PATH

  const landing = resolveDefaultLandingPath(caps, enabledModules)
  if (
    landing !== pathname &&
    isPathModuleAccessible(landing, enabledModules, caps?.permissions)
  ) {
    return landing
  }

  return `${SIN_ACCESO_PATH}?reason=${denialReason}`
}
