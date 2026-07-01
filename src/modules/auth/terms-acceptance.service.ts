import 'server-only'
import { cache } from 'react'
import TermsAcceptance from './terms-acceptance.model'
import { CURRENT_TERMS_VERSION } from './terms-of-service'

async function loadHasAcceptedCurrentTerms(userId: string): Promise<boolean> {
  const latest = await TermsAcceptance.findOne({
    where: { user_id: userId },
    attributes: ['terms_version'],
    order: [['accepted_at', 'DESC']],
  })

  return latest?.terms_version === CURRENT_TERMS_VERSION
}

/**
 * True when the user's most recent terms acceptance matches the current version.
 * Deduplicated per request via React cache() — safe to call from layout and routes.
 */
export const hasAcceptedCurrentTerms = cache(loadHasAcceptedCurrentTerms)

/**
 * Records a new terms acceptance for the current version. Always inserts a new
 * row — this is an append-only audit log, never updated or upserted.
 */
export async function recordTermsAcceptance(
  userId: string,
  meta: { ipAddress: string | null; userAgent: string | null },
): Promise<void> {
  await TermsAcceptance.create({
    user_id: userId,
    terms_version: CURRENT_TERMS_VERSION,
    accepted_at: new Date(),
    ip_address: meta.ipAddress,
    user_agent: meta.userAgent,
  })
}
