import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext, TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import { listProductsForSale } from '@/modules/catalog/products.service'

const querySchema = z.object({
  search:        z.string().min(1).max(100).optional(),
  price_list_id: z.string().uuid().optional(),
  manage_stock:  z.enum(['true', 'false']).optional(),
  limit:         z.coerce.number().int().min(1).max(50).default(20),
})

export const GET = withPermission('sales:read', async (req, _ctx, session) => {
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const ctx = await makeTenantContext(session.user)
    const { search, price_list_id, manage_stock, limit } = parsed.data
    const manageStockFilter = manage_stock === 'true' ? true : manage_stock === 'false' ? false : undefined
    const data = await listProductsForSale(search, price_list_id, limit, ctx.orgId, manageStockFilter)
    return NextResponse.json({ data })
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    throw err
  }
})
