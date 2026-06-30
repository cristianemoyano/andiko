import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { TenancyError, TENANCY_ERROR_CODES, resolveTenantContext } from '@/lib/tenancy'
import { listWarehouses } from '@/modules/inventory/warehouses.service'

/** Depósitos disponibles al importar catálogo (solo id + nombre; permiso de catálogo). */
export const GET = withPermission('products:write', async (_req, _ctx, session) => {
  try {
    const ctxResult = await resolveTenantContext(session.user)
    if ('error' in ctxResult) return ctxResult.error
    const ctx = ctxResult.ctx
    const { data } = await listWarehouses({ page: 1, limit: 100 }, ctx)
    return NextResponse.json({
      data: data.map((w) => ({ id: w.id, name: w.name })),
    })
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    throw err
  }
})
