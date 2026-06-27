import { NextResponse } from 'next/server'
import { requireSysAdmin } from '@/lib/sys-admin-guard'
import { subscriptionUpdateSchema } from '@/modules/billing/subscription.schema'
import { getSubscription, updateSubscription } from '@/modules/billing/subscriptions.service'
import { billingErrorResponse } from '@/modules/billing/billing.errors'

type P = { id: string }

export async function GET(_req: Request, ctx: { params: Promise<P> }) {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  const { id } = await ctx.params
  try {
    const sub = await getSubscription(id)
    return NextResponse.json(sub)
  } catch (err) {
    const mapped = billingErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<P> }) {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  const { id } = await ctx.params
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = subscriptionUpdateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const sub = await updateSubscription(id, parsed.data, gate.session.user!.id as string)
    return NextResponse.json(sub)
  } catch (err) {
    const mapped = billingErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}
