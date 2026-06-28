import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { TenancyError, TENANCY_ERROR_CODES, resolveTenantContext } from '@/lib/tenancy'
import { getStockItemBatches } from '@/modules/inventory/stock-items.service'

export const GET = withPermission('inventory:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const tenantResult = await resolveTenantContext(session.user)
    if ('error' in tenantResult) return tenantResult.error
    const tenant = tenantResult.ctx
    const data = await getStockItemBatches(id, tenant.orgId)
    return NextResponse.json({ data })
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    if (err instanceof Error && err.message === 'STOCK_ITEM_NOT_FOUND') {
      return NextResponse.json({ error: 'Ítem de stock no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
