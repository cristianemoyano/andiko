import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { TenancyError, TENANCY_ERROR_CODES, resolveTenantContext } from '@/lib/tenancy'
import { catalogStockCandidatesQuerySchema } from '@/modules/inventory/warehouse-catalog-stock.schema'
import { listCatalogStockCandidates } from '@/modules/inventory/warehouse-catalog-stock.service'

type P = { id: string }

export const GET = withPermission<P>('inventory:read', async (req, ctx, session) => {
  const { id } = await ctx.params
  const parsed = catalogStockCandidatesQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const tenantResult = await resolveTenantContext(session.user)
    if ('error' in tenantResult) return tenantResult.error
    const result = await listCatalogStockCandidates(id, parsed.data, tenantResult.ctx)
    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof TenancyError) {
      if (err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
        return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
      }
      if (err.code === TENANCY_ERROR_CODES.BRANCH_NOT_ALLOWED) {
        return NextResponse.json({ error: 'No tenés acceso a esa sucursal.', code: err.code }, { status: 403 })
      }
    }
    if (err instanceof Error && err.message === 'WAREHOUSE_NOT_FOUND') {
      return NextResponse.json({ error: 'Depósito no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
