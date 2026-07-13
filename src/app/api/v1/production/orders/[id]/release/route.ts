import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { releaseProductionOrder } from '@/modules/production/production-orders.service'

export const POST = withPermission('production:write', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  try {
    const order = await releaseProductionOrder(id, orgScope.orgId, resolveActorId(session))
    return NextResponse.json(order)
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'PRODUCTION_ORDER_NOT_FOUND')    return NextResponse.json({ error: 'Orden de producción no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'PRODUCTION_ORDER_INVALID_STATUS') return NextResponse.json({ error: 'La orden no está en borrador', code: 'INVALID_STATUS' }, { status: 409 })
      if (err.message === 'PRODUCTION_ORDER_NO_WAREHOUSE')  return NextResponse.json({ error: 'La orden debe tener un depósito asignado', code: 'PRODUCTION_ORDER_NO_WAREHOUSE' }, { status: 422 })
      if (err.message === 'INSUFFICIENT_STOCK')             return NextResponse.json({ error: 'Stock insuficiente de uno de los insumos', code: 'INSUFFICIENT_STOCK' }, { status: 422 })
    }
    return NextResponse.json({ error: 'Error interno del servidor', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
})
