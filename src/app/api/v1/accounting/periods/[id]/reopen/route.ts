import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveTenantContext } from '@/lib/tenancy'
import { reopenPeriod } from '@/modules/accounting/period-close.service'

export const POST = withPermission<{ id: string }>('accounting:write', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const tenantResult = await resolveTenantContext(session.user)
  if ('error' in tenantResult) return tenantResult.error

  try {
    const period = await reopenPeriod(id, tenantResult.ctx, resolveActorId(session))
    return NextResponse.json(period)
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'PERIOD_NOT_FOUND') {
        return NextResponse.json({ error: 'Período no encontrado.', code: 'PERIOD_NOT_FOUND' }, { status: 404 })
      }
      if (err.message === 'PERIOD_NOT_CLOSED') {
        return NextResponse.json(
          { error: 'El período no está cerrado (o ya fue reabierto).', code: 'PERIOD_NOT_CLOSED' },
          { status: 409 },
        )
      }
    }
    throw err
  }
})
