import { NextResponse } from 'next/server'
import { requireOrgBilling } from '@/lib/org-billing-guard'
import { getOrgSubscription, getOrgCurrentUsage } from '@/modules/billing/org-billing.service'

/** Org-scoped billing overview: the org's current subscription + current usage. */
export async function GET() {
  const gate = await requireOrgBilling()
  if ('response' in gate) return gate.response

  const subscription = await getOrgSubscription(gate.orgId)
  const usage = subscription ? await getOrgCurrentUsage(subscription) : null

  return NextResponse.json({ subscription, usage })
}
