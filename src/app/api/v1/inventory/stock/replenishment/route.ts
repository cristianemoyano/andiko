import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext, TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import { getReplenishmentList } from '@/modules/inventory/stock-items.service'

export const GET = withPermission('inventory:read', async (_req, _ctx, session) => {
  try {
    const ctx = await makeTenantContext(session.user)
    const data = await getReplenishmentList(ctx.orgId)
    return NextResponse.json({ data, count: data.length })
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    throw err
  }
})
