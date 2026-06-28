import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { resolveTenantContext } from '@/lib/tenancy'
import { confirmPurchaseReturn } from '@/modules/purchases/purchase-returns.service'

type P = { id: string }

export const POST = withPermission<P>('purchases:write', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const tenantCtxResult = await resolveTenantContext(session.user)
    if ('error' in tenantCtxResult) return tenantCtxResult.error
    const tenantCtx = tenantCtxResult.ctx
    const row = await confirmPurchaseReturn(id, tenantCtx)
    return NextResponse.json(row)
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'PURCHASE_RETURN_NOT_FOUND') return NextResponse.json({ error: 'Devolución no encontrada', code: err.message }, { status: 404 })
      if (err.message === 'PURCHASE_RETURN_ALREADY_CONFIRMED') return NextResponse.json({ error: 'La devolución ya fue confirmada', code: err.message }, { status: 409 })
      if (err.message === 'INSUFFICIENT_STOCK') return NextResponse.json({ error: 'Stock insuficiente para la devolución', code: err.message }, { status: 422 })
    }
    throw err
  }
})
