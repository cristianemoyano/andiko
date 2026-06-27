import { NextResponse } from 'next/server'
import { requireOrgBilling } from '@/lib/org-billing-guard'
import { paginationSchema } from '@/lib/pagination'
import { listOrgInvoices } from '@/modules/billing/org-billing.service'

/** Org-scoped invoice list for the billing dashboard. */
export async function GET(req: Request) {
  const gate = await requireOrgBilling()
  if ('response' in gate) return gate.response

  const url = new URL(req.url)
  const parsed = paginationSchema.safeParse(Object.fromEntries(url.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }

  const result = await listOrgInvoices(gate.orgId, parsed.data.page, parsed.data.limit)
  return NextResponse.json(result)
}
