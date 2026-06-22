import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { resolveCapabilities } from '@/lib/capabilities'
import { resolvePostAuthRedirect } from '@/lib/post-auth-redirect'
import { getOnboardingStatus } from '@/modules/auth/onboarding.service'
import { ConfiguracionClient } from './ConfiguracionClient'

export const metadata: Metadata = { title: 'Configuración — Andiko ERP' }

export default async function ConfiguracionPage() {
  const session = await auth()
  const caps = await resolveCapabilities(session)

  if (!caps?.nav.configuracion) {
    redirect(await resolvePostAuthRedirect(session!))
  }

  let onboardingBanner: 'resume' | 'revisit' | null = null
  const orgId = session?.user?.orgId
  if (orgId && caps?.onboarding.manage) {
    const status = await getOnboardingStatus(orgId)
    if (!status.completed && status.hasProgress) {
      onboardingBanner = 'resume'
    } else if (status.completed) {
      onboardingBanner = 'revisit'
    }
  }

  return <ConfiguracionClient onboardingBanner={onboardingBanner} />
}
