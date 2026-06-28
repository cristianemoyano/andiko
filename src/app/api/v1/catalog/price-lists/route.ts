import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveTenantContext } from '@/lib/tenancy'
import { priceListSchema, priceListQuerySchema } from '@/modules/catalog/price-list.schema'
import { listPriceLists, createPriceList } from '@/modules/catalog/price-list.service'

export const GET = withPermission('products:read', async (req, _ctx, session) => {
  const parsed = priceListQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }

  const tenantResult = await resolveTenantContext(session.user)
  if ('error' in tenantResult) return tenantResult.error

  const result = await listPriceLists(parsed.data, tenantResult.ctx.orgId)
  return NextResponse.json(result)
})

export const POST = withPermission('products:write', async (req, _ctx, session) => {
  const body = await req.json()
  const parsed = priceListSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  const tenantResult = await resolveTenantContext(session.user)
  if ('error' in tenantResult) return tenantResult.error

  const priceList = await createPriceList(parsed.data, resolveActorId(session), tenantResult.ctx.orgId)
  return NextResponse.json(priceList, { status: 201 })
})
