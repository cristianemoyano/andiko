import { NextResponse } from 'next/server'
import { requireSysAdmin } from '@/lib/sys-admin-guard'
import { deleteBillingPayment } from '@/modules/billing/billing-payments.service'
import { billingErrorResponse } from '@/modules/billing/billing.errors'

type P = { id: string }

export async function DELETE(_req: Request, ctx: { params: Promise<P> }) {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  const { id } = await ctx.params
  try {
    await deleteBillingPayment(id, gate.session.user!.id as string)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    const mapped = billingErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}
