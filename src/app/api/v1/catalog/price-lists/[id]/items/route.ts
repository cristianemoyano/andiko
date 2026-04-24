import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { priceListItemSchema } from '@/modules/catalog/price-list.schema'
import { listPriceListItems, setPriceListItem } from '@/modules/catalog/price-list.service'

type P = { id: string }

export const GET = withPermission<P>('products:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const items = await listPriceListItems(id, session.user.orgId)
    return NextResponse.json(items)
  } catch (err) {
    if (err instanceof Error && err.message === 'PRICE_LIST_NOT_FOUND') {
      return NextResponse.json({ error: 'Lista de precios no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})

export const POST = withPermission<P>('products:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = priceListItemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  try {
    const item = await setPriceListItem(id, parsed.data, resolveActorId(session), session.user.orgId)
    return NextResponse.json(item, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'PRICE_LIST_NOT_FOUND') {
      return NextResponse.json({ error: 'Lista de precios no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
