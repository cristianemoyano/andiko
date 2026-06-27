import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext } from '@/lib/tenancy'
import { purchaseReturnQuerySchema, createPurchaseReturnSchema } from '@/modules/purchases/purchase-return.schema'
import { listPurchaseReturns, createPurchaseReturn } from '@/modules/purchases/purchase-returns.service'

export const GET = withPermission('purchases:read', async (req, _ctx, session) => {
  const parsed = purchaseReturnQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  const ctx = await makeTenantContext(session.user)
  const result = await listPurchaseReturns(parsed.data, ctx)
  return NextResponse.json(result)
})

export const POST = withPermission('purchases:write', async (req, _ctx, session) => {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 }) }

  const parsed = createPurchaseReturnSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const ctx = await makeTenantContext(session.user)
    const row = await createPurchaseReturn(parsed.data, ctx)
    return NextResponse.json(row, { status: 201 })
  } catch (err) {
    return mapReturnError(err)
  }
})

function mapReturnError(err: unknown) {
  if (!(err instanceof Error)) throw err
  const map: Record<string, { status: number; message: string }> = {
    ORDER_NOT_FOUND:                   { status: 404, message: 'Orden de compra no encontrada' },
    ORDER_NOT_RETURNABLE:              { status: 422, message: 'La orden no admite devoluciones en su estado actual' },
    ORDER_BRANCH_REQUIRED:             { status: 422, message: 'La orden no tiene sucursal asignada' },
    WAREHOUSE_REQUIRED:                { status: 422, message: 'No hay depósito configurado para la sucursal' },
    ORDER_ITEM_NOT_FOUND:              { status: 422, message: 'Ítem de orden no encontrado' },
    RETURN_QUANTITY_EXCEEDS_AVAILABLE: { status: 422, message: 'La cantidad a devolver supera lo recibido' },
  }
  const hit = map[err.message]
  if (hit) return NextResponse.json({ error: hit.message, code: err.message }, { status: hit.status })
  throw err
}
