import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { resolveCapabilities } from '@/lib/capabilities'
import { shouldSkipOnboardingEnforcement } from '@/lib/onboarding-guards'
import { resolveDefaultLandingPath } from '@/lib/panel-access'
import { resolvePostAuthRedirect } from '@/lib/post-auth-redirect'
import { getEffectiveOrganizationSettings } from '@/modules/auth/organization-settings.service'
import { getOnboardingStatus } from '@/modules/auth/onboarding.service'
import { OnboardingWizardClient } from './OnboardingWizardClient'

export const metadata = { title: 'Configuración inicial — Andiko ERP' }

type Props = { searchParams: Promise<{ revisit?: string }> }

export default async function OnboardingPage({ searchParams }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  const orgId = session.user.orgId
  if (!orgId) {
    redirect(await resolvePostAuthRedirect(session))
  }

  if (shouldSkipOnboardingEnforcement(session.user)) {
    const caps = await resolveCapabilities(session)
    const enabledModules = (await getEffectiveOrganizationSettings(orgId)).enabled_modules
    redirect(resolveDefaultLandingPath(caps, enabledModules))
  }

  const caps = await resolveCapabilities(session)
  if (!caps?.onboarding.manage) {
    const enabledModules = (await getEffectiveOrganizationSettings(orgId)).enabled_modules
    redirect(resolveDefaultLandingPath(caps, enabledModules))
  }

  const { revisit } = await searchParams
  const allowRevisit = revisit === '1'

  const status = await getOnboardingStatus(orgId)

  if (status.completed && !allowRevisit) {
    redirect(await resolvePostAuthRedirect(session))
  }

  return (
    <OnboardingWizardClient
      orgId={orgId}
      userEmail={session.user.email ?? ''}
      userName={session.user.name ?? ''}
      initialData={status.data ?? undefined}
      isRevisit={allowRevisit && status.completed}
    />
  )
}
