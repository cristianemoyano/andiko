import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { TenancyError, TENANCY_ERROR_CODES, resolveTenantContext } from '@/lib/tenancy'
import { getReconciliationDetail } from '@/modules/purchases/purchase-reconciliation.service'

type P = { id: string }

export const GET = withPermission<P>('purchases:read', async (_req, ctx, session) => {
  const { id } = await ctx.params

  try {
    const tenantCtxResult = await resolveTenantContext(session.user)
    if ('error' in tenantCtxResult) return tenantCtxResult.error
    const tenantCtx = tenantCtxResult.ctx
    const detail = await getReconciliationDetail(id, tenantCtx)
    return NextResponse.json(detail)
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    if (err instanceof Error && err.message === 'PURCHASE_ORDER_NOT_FOUND') {
      return NextResponse.json({ error: 'Orden de compra no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
