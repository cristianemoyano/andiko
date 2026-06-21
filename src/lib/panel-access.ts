import { NAV_MODULES } from '@/components/layout/nav-items'
import type { OrgModuleKey } from '@/modules/auth/organization-modules'
import type { Permission } from '@/lib/permissions'
import type { UiCapabilities } from '@/types/capabilities'
import { isModuleNavVisible } from '@/lib/nav-module-access'

export function hasPanelAccess(permissions: readonly Permission[]): boolean {
  return permissions.includes('panel:read')
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
