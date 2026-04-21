import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { removePriceListItem } from '@/modules/catalog/price-list.service'

type P = { id: string; itemId: string }

export const DELETE = withPermission<P>('products:delete', async (_req, ctx, session) => {
  const { itemId } = await ctx.params
  try {
    await removePriceListItem(itemId, session.user.id!, session.user.orgId)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof Error && err.message === 'PRICE_LIST_ITEM_NOT_FOUND') {
      return NextResponse.json({ error: 'Item no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
