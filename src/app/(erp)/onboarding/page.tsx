import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getOnboardingStatus } from '@/modules/auth/onboarding.service'
import { OnboardingWizardClient } from './OnboardingWizardClient'

export const metadata = { title: 'Configuración inicial — Andiko ERP' }

export default async function OnboardingPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const orgId = session.user.orgId
  if (!orgId) redirect('/login')

  const status = await getOnboardingStatus(orgId)

  // Already completed — redirect to main ERP
  if (status.completed) redirect('/panel')

  return (
    <OnboardingWizardClient
      orgId={orgId}
      userEmail={session.user.email ?? ''}
      userName={session.user.name ?? ''}
      initialData={status.data ?? undefined}
    />
  )
}
