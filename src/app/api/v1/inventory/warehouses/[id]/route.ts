import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { TenancyError, TENANCY_ERROR_CODES, resolveTenantContext } from '@/lib/tenancy'
import { warehouseUpdateSchema } from '@/modules/inventory/warehouse.schema'
import { getWarehouse, updateWarehouse, deleteWarehouse } from '@/modules/inventory/warehouses.service'

type P = { id: string }

export const GET = withPermission<P>('inventory:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const tenantResult = await resolveTenantContext(session.user)
    if ('error' in tenantResult) return tenantResult.error
    const tenant = tenantResult.ctx
    const warehouse = await getWarehouse(id, tenant.orgId)
    return NextResponse.json(warehouse)
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    if (err instanceof Error && err.message === 'WAREHOUSE_NOT_FOUND') {
      return NextResponse.json({ error: 'Depósito no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})

export const PATCH = withPermission<P>('inventory:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = warehouseUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  try {
    const tenantResult = await resolveTenantContext(session.user)
    if ('error' in tenantResult) return tenantResult.error
    const tenant = tenantResult.ctx
    const warehouse = await updateWarehouse(id, parsed.data, tenant, resolveActorId(session))
    return NextResponse.json(warehouse)
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    if (err instanceof Error && err.message === 'WAREHOUSE_NOT_FOUND') {
      return NextResponse.json({ error: 'Depósito no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})

export const DELETE = withPermission<P>('inventory:delete', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const tenantResult = await resolveTenantContext(session.user)
    if ('error' in tenantResult) return tenantResult.error
    const tenant = tenantResult.ctx
    await deleteWarehouse(id, tenant, resolveActorId(session))
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    if (err instanceof Error && err.message === 'WAREHOUSE_NOT_FOUND') {
      return NextResponse.json({ error: 'Depósito no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
