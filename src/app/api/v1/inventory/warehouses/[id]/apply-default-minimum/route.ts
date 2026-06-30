import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { TenancyError, TENANCY_ERROR_CODES, resolveTenantContext } from '@/lib/tenancy'
import { applyWarehouseDefaultMinimumSchema } from '@/modules/inventory/stock-level.schema'
import { applyWarehouseDefaultMinimum } from '@/modules/inventory/stock-items.service'

type P = { id: string }

export const POST = withPermission<P>('inventory:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const parsed = applyWarehouseDefaultMinimumSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  try {
    const tenantResult = await resolveTenantContext(session.user)
    if ('error' in tenantResult) return tenantResult.error
    const tenant = tenantResult.ctx
    const result = await applyWarehouseDefaultMinimum(tenant, id, parsed.data)
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
