import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext, TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import { stockMovementQuerySchema, manualAdjustmentSchema } from '@/modules/inventory/stock-movement.schema'
import { listMovements, manualAdjustment } from '@/modules/inventory/stock-movements.service'

export const GET = withPermission('inventory:read', async (req, _ctx, session) => {
  const parsed = stockMovementQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const ctx = await makeTenantContext(session.user)
    const result = await listMovements(parsed.data, ctx.orgId)
    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    throw err
  }
})

export const POST = withPermission('inventory:write', async (req, _ctx, session) => {
  const body = await req.json()
  const parsed = manualAdjustmentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  try {
    const ctx = await makeTenantContext(session.user)
    await manualAdjustment(
      parsed.data.variant_id,
      parsed.data.warehouse_id,
      parsed.data.quantity,
      parsed.data.notes ?? null,
      ctx,
    )
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    if (err instanceof Error && err.message === 'INSUFFICIENT_STOCK') {
      return NextResponse.json({ error: 'Stock insuficiente', code: 'INSUFFICIENT_STOCK' }, { status: 409 })
    }
    throw err
  }
})
