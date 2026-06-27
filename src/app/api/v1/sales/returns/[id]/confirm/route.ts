import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext } from '@/lib/tenancy'
import { confirmReturn } from '@/modules/sales/sales-returns.service'

type P = { id: string }

export const POST = withPermission<P>('sales:write', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const tenantCtx = await makeTenantContext(session.user)
    const row = await confirmReturn(id, tenantCtx)
    return NextResponse.json(row)
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'SALES_RETURN_NOT_FOUND') return NextResponse.json({ error: 'Devolución no encontrada', code: err.message }, { status: 404 })
      if (err.message === 'SALES_RETURN_ALREADY_CONFIRMED') return NextResponse.json({ error: 'La devolución ya fue confirmada', code: err.message }, { status: 409 })
      if (err.message === 'INSUFFICIENT_STOCK') return NextResponse.json({ error: 'Stock insuficiente para el cambio', code: err.message }, { status: 422 })
    }
    throw err
  }
})
