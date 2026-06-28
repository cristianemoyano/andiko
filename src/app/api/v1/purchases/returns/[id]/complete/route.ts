import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { resolveTenantContext } from '@/lib/tenancy'
import { completePurchaseReturnSchema } from '@/modules/purchases/purchase-return.schema'
import { completePurchaseReturn } from '@/modules/purchases/purchase-returns.service'

type P = { id: string }

export const POST = withPermission<P>('purchases:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  let body: unknown = {}
  try { body = await req.json() } catch { /* empty body ok */ }

  const parsed = completePurchaseReturnSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const tenantCtxResult = await resolveTenantContext(session.user)
    if ('error' in tenantCtxResult) return tenantCtxResult.error
    const tenantCtx = tenantCtxResult.ctx
    const row = await completePurchaseReturn(id, parsed.data, tenantCtx)
    return NextResponse.json(row)
  } catch (err) {
    if (err instanceof Error) {
      const codes: Record<string, { status: number; message: string }> = {
        PURCHASE_RETURN_NOT_FOUND:         { status: 404, message: 'Devolución no encontrada' },
        PURCHASE_RETURN_ALREADY_COMPLETED: { status: 409, message: 'La devolución ya fue completada' },
        PURCHASE_RETURN_CANCELLED:         { status: 409, message: 'La devolución está anulada' },
        INSUFFICIENT_STOCK:                { status: 422, message: 'Stock insuficiente' },
      }
      const hit = codes[err.message]
      if (hit) return NextResponse.json({ error: hit.message, code: err.message }, { status: hit.status })
    }
    throw err
  }
})
