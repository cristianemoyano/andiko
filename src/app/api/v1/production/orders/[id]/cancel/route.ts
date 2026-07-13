import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { cancelProductionOrder } from '@/modules/production/production-orders.service'

export const POST = withPermission('production:write', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  try {
    const order = await cancelProductionOrder(id, orgScope.orgId, resolveActorId(session))
    return NextResponse.json(order)
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'PRODUCTION_ORDER_NOT_FOUND')      return NextResponse.json({ error: 'Orden de producción no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'PRODUCTION_ORDER_INVALID_STATUS') return NextResponse.json({ error: 'La orden ya está terminada o cancelada', code: 'INVALID_STATUS' }, { status: 409 })
    }
    throw err
  }
})
