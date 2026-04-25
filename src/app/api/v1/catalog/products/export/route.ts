import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext, TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import { toCsvText } from '@/lib/csv'
import { listProductsForExport } from '@/modules/catalog/products.service'
import { PRODUCT_CSV_HEADERS, productToRow } from '@/modules/catalog/products-csv-adapter'

const EXPORT_LIMIT = 10_000

const exportQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
})

export const GET = withPermission('products:read', async (req, _ctx, session) => {
  const params = Object.fromEntries(req.nextUrl.searchParams)
  const parsed = exportQuerySchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  try {
    const ctx = await makeTenantContext(session.user)
    const products = await listProductsForExport(parsed.data, ctx, EXPORT_LIMIT)
    const csv = toCsvText(products.map((product) => productToRow(product)), PRODUCT_CSV_HEADERS)

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="productos.csv"',
      },
    })
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    throw err
  }
})
