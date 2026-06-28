import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { resolveTenantContext } from '@/lib/tenancy'
import { salesReturnQuerySchema, createSalesReturnSchema } from '@/modules/sales/sales-return.schema'
import { listSalesReturns, createReturnFromOrder } from '@/modules/sales/sales-returns.service'

export const GET = withPermission('sales:read', async (req, _ctx, session) => {
  const parsed = salesReturnQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  const ctxResult = await resolveTenantContext(session.user)
    if ('error' in ctxResult) return ctxResult.error
    const ctx = ctxResult.ctx
  const result = await listSalesReturns(parsed.data, ctx)
  return NextResponse.json(result)
})

export const POST = withPermission('sales:write', async (req, _ctx, session) => {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 }) }

  const parsed = createSalesReturnSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const ctxResult = await resolveTenantContext(session.user)
    if ('error' in ctxResult) return ctxResult.error
    const ctx = ctxResult.ctx
    const row = await createReturnFromOrder(parsed.data, ctx)
    return NextResponse.json(row, { status: 201 })
  } catch (err) {
    return mapReturnError(err)
  }
})

function mapReturnError(err: unknown) {
  if (!(err instanceof Error)) throw err
  const map: Record<string, { status: number; message: string }> = {
    ORDER_NOT_FOUND:                 { status: 404, message: 'Pedido no encontrado' },
    ORDER_NOT_RETURNABLE:            { status: 422, message: 'El pedido no admite devoluciones en su estado actual' },
    ORDER_BRANCH_REQUIRED:           { status: 422, message: 'El pedido no tiene sucursal asignada' },
    WAREHOUSE_REQUIRED:              { status: 422, message: 'No hay depósito configurado para la sucursal' },
    ORDER_ITEM_NOT_FOUND:            { status: 422, message: 'Ítem de pedido no encontrado' },
    RETURN_QUANTITY_EXCEEDS_AVAILABLE: { status: 422, message: 'La cantidad a devolver supera lo disponible' },
  }
  const hit = map[err.message]
  if (hit) return NextResponse.json({ error: hit.message, code: err.message }, { status: hit.status })
  throw err
}
