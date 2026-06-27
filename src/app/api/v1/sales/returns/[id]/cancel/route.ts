import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext } from '@/lib/tenancy'
import { cancelReturn } from '@/modules/sales/sales-returns.service'

type P = { id: string }

export const POST = withPermission<P>('sales:write', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const tenantCtx = await makeTenantContext(session.user)
    const row = await cancelReturn(id, tenantCtx)
    return NextResponse.json(row)
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'SALES_RETURN_NOT_FOUND') return NextResponse.json({ error: 'Devolución no encontrada', code: err.message }, { status: 404 })
      if (err.message === 'SALES_RETURN_ALREADY_CANCELLED') return NextResponse.json({ error: 'La devolución ya está anulada', code: err.message }, { status: 409 })
      if (err.message === 'SALES_RETURN_ALREADY_COMPLETED') return NextResponse.json({ error: 'No se puede anular una devolución completada', code: err.message }, { status: 409 })
    }
    throw err
  }
})
