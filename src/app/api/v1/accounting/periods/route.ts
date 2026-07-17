import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveTenantContext } from '@/lib/tenancy'
import { accountingPeriodQuerySchema, closePeriodSchema } from '@/modules/accounting/accounting-period.schema'
import { closePeriod, listPeriodCloses } from '@/modules/accounting/period-close.service'

export const GET = withPermission('accounting:read', async (req, _ctx, session) => {
  const parsed = accountingPeriodQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  const tenantResult = await resolveTenantContext(session.user)
  if ('error' in tenantResult) return tenantResult.error
  const result = await listPeriodCloses(parsed.data, tenantResult.ctx)
  return NextResponse.json(result)
})

export const POST = withPermission('accounting:write', async (req, _ctx, session) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.', code: 'VALIDATION_ERROR' }, { status: 400 })
  }
  const parsed = closePeriodSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  const tenantResult = await resolveTenantContext(session.user)
  if ('error' in tenantResult) return tenantResult.error

  try {
    const period = await closePeriod(parsed.data, tenantResult.ctx, resolveActorId(session))
    return NextResponse.json(period, { status: 201 })
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'PERIOD_OVERLAP') {
        return NextResponse.json(
          { error: 'El rango se superpone con un período ya cerrado.', code: 'PERIOD_OVERLAP' },
          { status: 409 },
        )
      }
      if (err.message === 'NOTHING_TO_CLOSE') {
        return NextResponse.json(
          { error: 'No hay cuentas de resultado con movimientos en el período.', code: 'NOTHING_TO_CLOSE' },
          { status: 422 },
        )
      }
      if (err.message === 'CLOSING_ACCOUNT_MISSING') {
        return NextResponse.json(
          { error: 'Falta la cuenta Resultado del ejercicio (3.2.02) activa e imputable en el plan de cuentas.', code: 'CLOSING_ACCOUNT_MISSING' },
          { status: 422 },
        )
      }
    }
    throw err
  }
})
