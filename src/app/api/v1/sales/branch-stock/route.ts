import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withPermission } from '@/lib/api-handler'
import { TenancyError, TENANCY_ERROR_CODES, resolveTenantContext } from '@/lib/tenancy'
import { branchWarehouseResolutionResponse } from '@/lib/inventory-route-errors'
import { getBranchVariantStock } from '@/modules/sales/sales-line-stock.service'

const querySchema = z.object({
  branch_id: z.string().uuid(),
  variant_ids: z
    .string()
    .min(1)
    .transform((value) => value.split(',').map((id) => id.trim()).filter(Boolean))
    .pipe(z.array(z.string().uuid()).min(1).max(50)),
})

export const GET = withPermission('sales:read', async (req, _ctx, session) => {
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const ctxResult = await resolveTenantContext(session.user)
    if ('error' in ctxResult) return ctxResult.error
    const ctx = ctxResult.ctx
    const data = await getBranchVariantStock(parsed.data.branch_id, parsed.data.variant_ids, ctx.orgId)
    return NextResponse.json({ data })
  } catch (err: unknown) {
    const branchWarehouseErr = branchWarehouseResolutionResponse(err)
    if (branchWarehouseErr) return branchWarehouseErr
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    throw err
  }
})
