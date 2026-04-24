import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { priceListUpdateSchema } from '@/modules/catalog/price-list.schema'
import { getPriceList, updatePriceList, deletePriceList } from '@/modules/catalog/price-list.service'

type P = { id: string }

export const GET = withPermission<P>('products:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const priceList = await getPriceList(id, session.user.orgId)
    return NextResponse.json(priceList)
  } catch {
    return NextResponse.json({ error: 'Lista de precios no encontrada', code: 'NOT_FOUND' }, { status: 404 })
  }
})

export const PATCH = withPermission<P>('products:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = priceListUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  try {
    const priceList = await updatePriceList(id, parsed.data, resolveActorId(session), session.user.orgId)
    return NextResponse.json(priceList)
  } catch (err) {
    if (err instanceof Error && err.message === 'PRICE_LIST_NOT_FOUND') {
      return NextResponse.json({ error: 'Lista de precios no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})

export const DELETE = withPermission<P>('products:delete', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    await deletePriceList(id, resolveActorId(session), session.user.orgId)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof Error && err.message === 'PRICE_LIST_NOT_FOUND') {
      return NextResponse.json({ error: 'Lista de precios no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    if (err instanceof Error && err.message === 'CANNOT_DELETE_DEFAULT_PRICE_LIST') {
      return NextResponse.json({ error: 'No se puede eliminar la lista de precios predeterminada', code: 'CANNOT_DELETE_DEFAULT' }, { status: 409 })
    }
    throw err
  }
})
