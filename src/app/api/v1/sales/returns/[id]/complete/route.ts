import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext } from '@/lib/tenancy'
import { completeSalesReturnSchema } from '@/modules/sales/sales-return.schema'
import { completeReturn } from '@/modules/sales/sales-returns.service'

type P = { id: string }

export const POST = withPermission<P>('sales:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  let body: unknown = {}
  try { body = await req.json() } catch { /* empty body ok */ }

  const parsed = completeSalesReturnSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const tenantCtx = await makeTenantContext(session.user)
    const row = await completeReturn(id, parsed.data, tenantCtx)
    return NextResponse.json(row)
  } catch (err) {
    if (err instanceof Error) {
      const codes: Record<string, { status: number; message: string }> = {
        SALES_RETURN_NOT_FOUND:        { status: 404, message: 'Devolución no encontrada' },
        SALES_RETURN_ALREADY_COMPLETED: { status: 409, message: 'La devolución ya fue completada' },
        SALES_RETURN_CANCELLED:        { status: 409, message: 'La devolución está anulada' },
        INSUFFICIENT_STOCK:            { status: 422, message: 'Stock insuficiente' },
      }
      const hit = codes[err.message]
      if (hit) return NextResponse.json({ error: hit.message, code: err.message }, { status: hit.status })
    }
    throw err
  }
})
