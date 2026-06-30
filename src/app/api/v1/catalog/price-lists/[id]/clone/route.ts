import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveTenantContext } from '@/lib/tenancy'
import { clonePriceListSchema } from '@/modules/catalog/price-list.schema'
import { clonePriceList } from '@/modules/catalog/price-list.service'

type P = { id: string }

export const POST = withPermission<P>('products:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = clonePriceListSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const tenantResult = await resolveTenantContext(session.user)
  if ('error' in tenantResult) return tenantResult.error

  try {
    const { priceList, items_copied } = await clonePriceList(
      id,
      parsed.data,
      resolveActorId(session),
      tenantResult.ctx.orgId,
    )
    return NextResponse.json({ ...priceList.toJSON(), items_copied }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'PRICE_LIST_NOT_FOUND') {
      return NextResponse.json({ error: 'Lista de precios no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
