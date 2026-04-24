import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext, TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import { stockLevelQuerySchema } from '@/modules/inventory/stock-level.schema'
import { getStockLevels } from '@/modules/inventory/stock-items.service'

export const GET = withPermission('inventory:read', async (req, _ctx, session) => {
  const parsed = stockLevelQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const ctx = await makeTenantContext(session.user)
    const result = await getStockLevels(parsed.data, ctx.orgId)
    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    throw err
  }
})
