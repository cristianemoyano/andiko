import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext } from '@/lib/tenancy'
import { listReturnsByOrder } from '@/modules/sales/sales-returns.service'

type P = { id: string }

export const GET = withPermission<P>('sales:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const tenantCtx = await makeTenantContext(session.user)
  const rows = await listReturnsByOrder(id, tenantCtx)
  return NextResponse.json({ data: rows })
})
