import 'server-only'
import type { Session } from 'next-auth'
import { resolveCapabilities } from '@/lib/capabilities'
import { resolveDefaultLandingPath } from '@/lib/panel-access'
import { getEffectiveOrganizationSettings } from '@/modules/auth/organization-settings.service'
import { getOnboardingStatus } from '@/modules/auth/onboarding.service'

export async function resolvePostAuthRedirect(session: Session): Promise<string> {
  const caps = await resolveCapabilities(session)
  const orgId = session.user?.orgId ?? null

  if (orgId && caps?.onboarding.manage) {
    const status = await getOnboardingStatus(orgId)
    if (!status.completed && !status.hasProgress) {
      return '/onboarding'
    }
  }

  const enabledModules = orgId
    ? (await getEffectiveOrganizationSettings(orgId)).enabled_modules
    : undefined
  return resolveDefaultLandingPath(caps, enabledModules)
}
