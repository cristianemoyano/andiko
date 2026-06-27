import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext } from '@/lib/tenancy'
import { updatePurchaseReturnSchema } from '@/modules/purchases/purchase-return.schema'
import { getPurchaseReturn, updatePurchaseReturn } from '@/modules/purchases/purchase-returns.service'

type P = { id: string }

export const GET = withPermission<P>('purchases:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const tenantCtx = await makeTenantContext(session.user)
    const row = await getPurchaseReturn(id, tenantCtx)
    return NextResponse.json(row)
  } catch (err) {
    if (err instanceof Error && err.message === 'PURCHASE_RETURN_NOT_FOUND') {
      return NextResponse.json({ error: 'Devolución no encontrada', code: err.message }, { status: 404 })
    }
    throw err
  }
})

export const PATCH = withPermission<P>('purchases:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 }) }

  const parsed = updatePurchaseReturnSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const tenantCtx = await makeTenantContext(session.user)
    const row = await updatePurchaseReturn(id, parsed.data, tenantCtx)
    return NextResponse.json(row)
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'PURCHASE_RETURN_NOT_FOUND') return NextResponse.json({ error: 'Devolución no encontrada', code: err.message }, { status: 404 })
      if (err.message === 'PURCHASE_RETURN_NOT_EDITABLE') return NextResponse.json({ error: 'La devolución no es editable', code: err.message }, { status: 409 })
      if (err.message === 'ORDER_ITEM_NOT_FOUND') return NextResponse.json({ error: 'Ítem de orden no encontrado', code: err.message }, { status: 422 })
      if (err.message === 'RETURN_QUANTITY_EXCEEDS_AVAILABLE') return NextResponse.json({ error: 'La cantidad a devolver supera lo recibido', code: err.message }, { status: 422 })
    }
    throw err
  }
})
