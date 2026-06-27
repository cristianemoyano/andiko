import { NextResponse } from 'next/server'
import { requireOrgBilling } from '@/lib/org-billing-guard'
import { getOrgBillingOverview } from '@/modules/billing/org-billing.service'

/** Org-scoped billing overview: subscription + usage + billing preview. */
export async function GET() {
  const gate = await requireOrgBilling()
  if ('response' in gate) return gate.response

  const overview = await getOrgBillingOverview(gate.orgId)
  return NextResponse.json(overview)
}
