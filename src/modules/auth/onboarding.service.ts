import 'server-only'

import { Organization, type OnboardingData } from './organization.model'
import logger from '@/lib/logger'
import { fiscalFieldsFromOnboarding } from '@/modules/afip/afip-config.service'

export async function getOnboardingStatus(orgId: string): Promise<{
  completed: boolean
  completedAt: Date | null
  data: OnboardingData | null
}> {
  const org = await Organization.findByPk(orgId, {
    attributes: ['id', 'onboarding_completed_at', 'onboarding_data'],
  })

  if (!org) {
    return { completed: false, completedAt: null, data: null }
  }

  return {
    completed: org.onboarding_completed_at !== null,
    completedAt: org.onboarding_completed_at,
    data: org.onboarding_data,
  }
}

export async function completeOnboarding(
  orgId: string,
  data: OnboardingData,
): Promise<void> {
  const fiscal = fiscalFieldsFromOnboarding(data)
  await Organization.update(
    {
      onboarding_completed_at: new Date(),
      onboarding_data: data,
      ...fiscal,
    },
    { where: { id: orgId } },
  )

  logger.info({ orgId }, 'onboarding completed')
}

export async function saveOnboardingProgress(
  orgId: string,
  data: OnboardingData,
): Promise<void> {
  await Organization.update(
    { onboarding_data: data },
    { where: { id: orgId } },
  )
}
