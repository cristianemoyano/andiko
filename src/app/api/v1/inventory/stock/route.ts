import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { TenancyError, TENANCY_ERROR_CODES, resolveTenantContext } from '@/lib/tenancy'
import { stockItemAlertsPatchSchema, stockLevelQuerySchema } from '@/modules/inventory/stock-level.schema'
import { getStockLevels, updateStockItemAlerts } from '@/modules/inventory/stock-items.service'

export const GET = withPermission('inventory:read', async (req, _ctx, session) => {
  const parsed = stockLevelQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const ctxResult = await resolveTenantContext(session.user)
    if ('error' in ctxResult) return ctxResult.error
    const ctx = ctxResult.ctx
    const result = await getStockLevels(parsed.data, ctx.orgId)
    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    throw err
  }
})

export const PATCH = withPermission('inventory:write', async (req, _ctx, session) => {
  const body = await req.json()
  const parsed = stockItemAlertsPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  try {
    const ctxResult = await resolveTenantContext(session.user)
    if ('error' in ctxResult) return ctxResult.error
    const ctx = ctxResult.ctx
    await updateStockItemAlerts(ctx, parsed.data)
    return new NextResponse(null, { status: 204 })
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
    if (err instanceof Error && err.message === 'VARIANT_NOT_FOUND') {
      return NextResponse.json({ error: 'Variante no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
