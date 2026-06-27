import { NextResponse } from 'next/server'
import { requireSysAdmin } from '@/lib/sys-admin-guard'
import { buildBillingInvoicePrintable } from '@/modules/printing/billing-adapter'
import { billingErrorResponse } from '@/modules/billing/billing.errors'

type P = { id: string }

export async function GET(_req: Request, ctx: { params: Promise<P> }) {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  const { id } = await ctx.params
  try {
    const data = await buildBillingInvoicePrintable(id)
    return NextResponse.json({ data })
  } catch (err) {
    const mapped = billingErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}
