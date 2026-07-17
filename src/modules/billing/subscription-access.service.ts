import 'server-only'
import { cache } from 'react'
import { Op } from 'sequelize'
import OrgSubscription from './org-subscription.model'

// Process-level cache: this is read on every (erp) page load and every mutating
// /api/v1 request (suspension gate in the api-handler wrappers), but subscription
// status only changes via dunning/payment flows, so a short TTL beats hitting the
// DB per request. `cache()` below only dedupes within a single request.
const SUSPENSION_CACHE_TTL_MS = 60_000
type SuspensionCacheEntry = { value: boolean; expiresAt: number }
const suspensionCache = new Map<string, SuspensionCacheEntry>()

async function loadOrgSuspended(orgId: string): Promise<boolean> {
  const entry = suspensionCache.get(orgId)
  if (entry && entry.expiresAt >= Date.now()) return entry.value

  // Same lookup shape as `getOrgSubscription` (org-billing.service.ts): latest
  // non-deleted, non-cancelled subscription for the org (paranoid model).
  const subscription = await OrgSubscription.findOne({
    where: { org_id: orgId, status: { [Op.ne]: 'cancelled' } },
    attributes: ['id', 'status'],
    order: [['created_at', 'DESC']],
  })

  const suspended = subscription?.status === 'past_due'
  suspensionCache.set(orgId, { value: suspended, expiresAt: Date.now() + SUSPENSION_CACHE_TTL_MS })
  return suspended
}

/**
 * Whether the org's ERP access is suspended (subscription in `past_due`).
 * Deduplicated per request via React cache() + process-level 60s TTL — dunning
 * and reactivation tolerate the lag.
 */
export const isOrgSuspended = cache(loadOrgSuspended)

/** Test helper — clears the process-level suspension cache. */
export function clearSubscriptionAccessCache(): void {
  suspensionCache.clear()
}
