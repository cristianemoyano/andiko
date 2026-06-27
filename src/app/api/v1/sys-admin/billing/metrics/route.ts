import { NextResponse } from 'next/server'
import { requireSysAdmin } from '@/lib/sys-admin-guard'
import { billingMetricSchema, billingMetricQuerySchema } from '@/modules/billing/billing-metric.schema'
import { listMetrics, createMetric } from '@/modules/billing/billing-metrics.service'
import { billingErrorResponse } from '@/modules/billing/billing.errors'

export async function GET(req: Request) {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  const url = new URL(req.url)
  const parsed = billingMetricQuerySchema.safeParse(Object.fromEntries(url.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }

  const result = await listMetrics(parsed.data)
  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = billingMetricSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const metric = await createMetric(parsed.data, gate.session.user!.id as string)
    return NextResponse.json(metric, { status: 201 })
  } catch (err) {
    const mapped = billingErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}
