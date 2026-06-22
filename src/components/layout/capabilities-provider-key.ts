import type { Session } from 'next-auth'
import type { UiCapabilities } from '@/types/capabilities'

export type CapabilitiesSessionIdentity = {
  id?: string
  role: string
  orgRoleId?: string | null
  impersonation?: { userId: string } | null
}

export function sessionCapabilitiesIdentity(session: Session): string {
  const u = session.user
  return [
    u.impersonation?.userId ?? u.id ?? '',
    u.role ?? '',
    u.orgRoleId ?? '',
    u.orgId ?? '',
  ].join('|')
}

/** Stable key for remounting CapabilitiesProvider when session or caps change. */
export function capabilitiesProviderKey(
  caps: UiCapabilities | null,
  session: CapabilitiesSessionIdentity | Session,
): string {
  const identity = 'user' in session
    ? sessionCapabilitiesIdentity(session)
    : [
        session.impersonation?.userId ?? session.id ?? '',
        session.role,
        session.orgRoleId ?? '',
      ].join('|')

  if (!caps) return `${identity}:none`

  return `${identity}:${JSON.stringify({
    nav: caps.nav,
    platform: caps.platform,
    orgSections: caps.organizacion.sections,
    orgActions: caps.organizacion.actions,
    orgApi: caps.organizacion.apiNamespace,
    tabs: caps.configuracion.tabs,
    onboarding: caps.onboarding,
  })}`
}
