import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { productionOrderUpdateSchema } from '@/modules/production/production-order.schema'
import { getProductionOrder, updateProductionOrder, deleteProductionOrder } from '@/modules/production/production-orders.service'

export const GET = withPermission('production:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  try {
    const order = await getProductionOrder(id, orgScope.orgId)
    return NextResponse.json(order)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'PRODUCTION_ORDER_NOT_FOUND') {
      return NextResponse.json({ error: 'Orden de producción no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})

export const PATCH = withPermission('production:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body   = await req.json()
  const parsed = productionOrderUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  try {
    const order = await updateProductionOrder(id, parsed.data, orgScope.orgId, resolveActorId(session))
    return NextResponse.json(order)
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'PRODUCTION_ORDER_NOT_FOUND')    return NextResponse.json({ error: 'Orden de producción no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'PRODUCTION_ORDER_NOT_DRAFT')    return NextResponse.json({ error: 'La orden no está en borrador', code: 'INVALID_STATUS' }, { status: 409 })
      if (err.message === 'BOM_NOT_FOUND')                 return NextResponse.json({ error: 'Receta no encontrada', code: 'BOM_NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})

export const DELETE = withPermission('production:delete', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  try {
    await deleteProductionOrder(id, orgScope.orgId, resolveActorId(session))
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'PRODUCTION_ORDER_NOT_FOUND') return NextResponse.json({ error: 'Orden de producción no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'PRODUCTION_ORDER_NOT_DRAFT') return NextResponse.json({ error: 'La orden no está en borrador', code: 'INVALID_STATUS' }, { status: 409 })
    }
    throw err
  }
})
