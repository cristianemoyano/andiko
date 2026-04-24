import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext, TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import { warehouseSchema, warehouseQuerySchema } from '@/modules/inventory/warehouse.schema'
import { listWarehouses, createWarehouse } from '@/modules/inventory/warehouses.service'

export const GET = withPermission('inventory:read', async (req, _ctx, session) => {
  const parsed = warehouseQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const ctx = await makeTenantContext(session.user)
    const result = await listWarehouses(parsed.data, ctx)
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
  const parsed = warehouseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  try {
    const ctx = await makeTenantContext(session.user)
    const warehouse = await createWarehouse(parsed.data, ctx, session.user.id!)
    return NextResponse.json(warehouse, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    throw err
  }
})
