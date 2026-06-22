import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { resolveCapabilities } from '@/lib/capabilities'
import { resolvePostAuthRedirect } from '@/lib/post-auth-redirect'
import { getOnboardingStatus } from '@/modules/auth/onboarding.service'
import { OnboardingWizardClient } from './OnboardingWizardClient'

export const metadata = { title: 'Configuración inicial — Andiko ERP' }

type Props = { searchParams: Promise<{ revisit?: string }> }

export default async function OnboardingPage({ searchParams }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  const caps = await resolveCapabilities(session)
  if (!caps?.onboarding.manage) {
    redirect(await resolvePostAuthRedirect(session))
  }

  const orgId = session.user.orgId
  if (!orgId) redirect('/login')

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
