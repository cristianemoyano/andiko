import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { priceListSchema, priceListQuerySchema } from '@/modules/catalog/price-list.schema'
import { listPriceLists, createPriceList } from '@/modules/catalog/price-list.service'

export const GET = withPermission('products:read', async (req, _ctx, session) => {
  const parsed = priceListQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  const result = await listPriceLists(parsed.data, session.user.orgId)
  return NextResponse.json(result)
})

export const POST = withPermission('products:write', async (req, _ctx, session) => {
  const body = await req.json()
  const parsed = priceListSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  const priceList = await createPriceList(parsed.data, session.user.id!, session.user.orgId)
  return NextResponse.json(priceList, { status: 201 })
})
