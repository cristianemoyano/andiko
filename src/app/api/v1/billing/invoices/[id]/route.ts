import { NextResponse } from 'next/server'
import { requireOrgBilling } from '@/lib/org-billing-guard'
import { getOrgInvoice } from '@/modules/billing/org-billing.service'
import { billingErrorResponse } from '@/modules/billing/billing.errors'

/** Org-scoped invoice detail (read-only) for the billing dashboard. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireOrgBilling()
  if ('response' in gate) return gate.response

  const { id } = await ctx.params
  try {
    const invoice = await getOrgInvoice(gate.orgId, id)
    return NextResponse.json(invoice)
  } catch (err) {
    const mapped = billingErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}
