import 'server-only'

import { Organization, type OnboardingData } from './organization.model'
import logger from '@/lib/logger'
import { fiscalFieldsFromOnboarding } from '@/modules/afip/afip-config.service'
import {
  BASE_TIER_MODULES,
  isOrgModuleKey,
  type OrgModuleKey,
} from './organization-modules'
import { updateOrganizationSettings } from './organization-settings.service'

function resolveModulesFromOnboarding(data: OnboardingData): OrgModuleKey[] {
  const raw = data.modules ?? []
  const valid = raw.filter((m): m is OrgModuleKey => isOrgModuleKey(m))
  return valid.length > 0 ? valid : [...BASE_TIER_MODULES]
}

export function hasOnboardingProgress(data: OnboardingData | null | undefined): boolean {
  return data != null && Object.keys(data).length > 0
}

export async function getOnboardingStatus(orgId: string): Promise<{
  completed: boolean
  completedAt: Date | null
  data: OnboardingData | null
  hasProgress: boolean
}> {
  const org = await Organization.findByPk(orgId, {
    attributes: ['id', 'onboarding_completed_at', 'onboarding_data'],
  })

  if (!org) {
    return { completed: false, completedAt: null, data: null, hasProgress: false }
  }

  const data = org.onboarding_data
  return {
    completed: org.onboarding_completed_at !== null,
    completedAt: org.onboarding_completed_at,
    data,
    hasProgress: hasOnboardingProgress(data),
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

  await updateOrganizationSettings(orgId, {
    enabled_modules: resolveModulesFromOnboarding(data),
  })

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
