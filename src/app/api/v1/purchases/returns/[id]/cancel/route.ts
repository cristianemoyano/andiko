import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { resolveTenantContext } from '@/lib/tenancy'
import { cancelPurchaseReturn } from '@/modules/purchases/purchase-returns.service'

type P = { id: string }

export const POST = withPermission<P>('purchases:write', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const tenantCtxResult = await resolveTenantContext(session.user)
    if ('error' in tenantCtxResult) return tenantCtxResult.error
    const tenantCtx = tenantCtxResult.ctx
    const row = await cancelPurchaseReturn(id, tenantCtx)
    return NextResponse.json(row)
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'PURCHASE_RETURN_NOT_FOUND') return NextResponse.json({ error: 'Devolución no encontrada', code: err.message }, { status: 404 })
      if (err.message === 'PURCHASE_RETURN_ALREADY_CANCELLED') return NextResponse.json({ error: 'La devolución ya está anulada', code: err.message }, { status: 409 })
      if (err.message === 'PURCHASE_RETURN_ALREADY_COMPLETED') return NextResponse.json({ error: 'No se puede anular una devolución completada', code: err.message }, { status: 409 })
    }
    throw err
  }
})
