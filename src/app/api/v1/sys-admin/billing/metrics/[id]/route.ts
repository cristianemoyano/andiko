import { NextResponse } from 'next/server'
import { requireSysAdmin } from '@/lib/sys-admin-guard'
import { billingMetricUpdateSchema } from '@/modules/billing/billing-metric.schema'
import { updateMetric } from '@/modules/billing/billing-metrics.service'
import { billingErrorResponse } from '@/modules/billing/billing.errors'

type P = { id: string }

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

  const parsed = billingMetricUpdateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const metric = await updateMetric(id, parsed.data, gate.session.user!.id as string)
    return NextResponse.json(metric)
  } catch (err) {
    const mapped = billingErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}
