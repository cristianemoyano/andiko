import 'server-only'
import { cache } from 'react'
import OrganizationSetting from './organization-setting.model'
import Organization from './organization.model'

export interface EffectiveTermsAndConditions {
  org_id: string
  terms_and_conditions: string | null
}

async function loadTermsAndConditions(orgId: string): Promise<EffectiveTermsAndConditions> {
  const row = await OrganizationSetting.findOne({
    where: { org_id: orgId },
    attributes: ['terms_and_conditions'],
  })

  return {
    org_id: orgId,
    terms_and_conditions: row?.terms_and_conditions ?? null,
  }
}

/** Deduplicated per request via React cache() — safe to call from print adapters and routes. */
export const getTermsAndConditions = cache(loadTermsAndConditions)

/** Persist the org's terms & conditions text (plain, nullable). */
export async function updateTermsAndConditions(
  orgId: string,
  text: string | null,
): Promise<EffectiveTermsAndConditions> {
  const org = await Organization.findByPk(orgId)
  if (!org) throw new Error('ORG_NOT_FOUND')

  const existing = await OrganizationSetting.findOne({ where: { org_id: orgId } })
  if (existing) {
    await existing.update({ terms_and_conditions: text })
  } else {
    await OrganizationSetting.create({ org_id: orgId, terms_and_conditions: text })
  }

  return { org_id: orgId, terms_and_conditions: text }
}
