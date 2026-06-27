import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext } from '@/lib/tenancy'
import { updateSalesReturnSchema } from '@/modules/sales/sales-return.schema'
import { getSalesReturn, updateSalesReturn } from '@/modules/sales/sales-returns.service'

type P = { id: string }

export const GET = withPermission<P>('sales:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const tenantCtx = await makeTenantContext(session.user)
    const row = await getSalesReturn(id, tenantCtx)
    return NextResponse.json(row)
  } catch (err) {
    if (err instanceof Error && err.message === 'SALES_RETURN_NOT_FOUND') {
      return NextResponse.json({ error: 'Devolución no encontrada', code: err.message }, { status: 404 })
    }
    throw err
  }
})

export const PATCH = withPermission<P>('sales:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 }) }

  const parsed = updateSalesReturnSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const tenantCtx = await makeTenantContext(session.user)
    const row = await updateSalesReturn(id, parsed.data, tenantCtx)
    return NextResponse.json(row)
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'SALES_RETURN_NOT_FOUND') return NextResponse.json({ error: 'Devolución no encontrada', code: err.message }, { status: 404 })
      if (err.message === 'SALES_RETURN_NOT_EDITABLE') return NextResponse.json({ error: 'La devolución no es editable', code: err.message }, { status: 409 })
    }
    throw err
  }
})
