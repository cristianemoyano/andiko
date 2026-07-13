import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { completeProductionOrderSchema } from '@/modules/production/production-order.schema'
import { completeProductionOrder } from '@/modules/production/production-orders.service'

export const POST = withPermission('production:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body   = await req.json().catch(() => ({}))
  const parsed = completeProductionOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  try {
    const order = await completeProductionOrder(id, parsed.data, orgScope.orgId, resolveActorId(session))
    return NextResponse.json(order)
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'PRODUCTION_ORDER_NOT_FOUND')      return NextResponse.json({ error: 'Orden de producción no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'PRODUCTION_ORDER_INVALID_STATUS') return NextResponse.json({ error: 'La orden no está liberada ni en proceso', code: 'INVALID_STATUS' }, { status: 409 })
      if (err.message === 'PRODUCTION_ORDER_NO_WAREHOUSE')   return NextResponse.json({ error: 'La orden debe tener un depósito asignado', code: 'PRODUCTION_ORDER_NO_WAREHOUSE' }, { status: 422 })
    }
    return NextResponse.json({ error: 'Error interno del servidor', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
})
