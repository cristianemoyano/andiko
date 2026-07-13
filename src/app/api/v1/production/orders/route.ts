import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { productionOrderSchema, productionOrderQuerySchema } from '@/modules/production/production-order.schema'
import { listProductionOrders, createProductionOrder } from '@/modules/production/production-orders.service'

export const GET = withPermission('production:read', async (req, _ctx, session) => {
  const parsed = productionOrderQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const result = await listProductionOrders(parsed.data, orgScope.orgId)
  return NextResponse.json(result)
})

export const POST = withPermission('production:write', async (req, _ctx, session) => {
  const body   = await req.json()
  const parsed = productionOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  try {
    const order = await createProductionOrder(parsed.data, orgScope.orgId, resolveActorId(session))
    return NextResponse.json(order, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'BRANCH_NOT_FOUND') return NextResponse.json({ error: 'Sucursal no encontrada o inactiva', code: 'BRANCH_NOT_FOUND' }, { status: 404 })
      if (err.message === 'BOM_NOT_FOUND')    return NextResponse.json({ error: 'No hay una receta activa para el producto elegido', code: 'BOM_NOT_FOUND' }, { status: 404 })
      if (err.message === 'BOM_EMPTY')        return NextResponse.json({ error: 'La receta no tiene componentes', code: 'BOM_EMPTY' }, { status: 422 })
    }
    throw err
  }
})
