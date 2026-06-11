import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { bulkPriceAdjustmentSchema } from '@/modules/catalog/bulk-price-adjustment.schema'
import { applyBulkPriceAdjustment } from '@/modules/catalog/bulk-price-adjustment.service'

export const POST = withPermission('products:write', async (req, _ctx, session) => {
  const body = await req.json()
  const parsed = bulkPriceAdjustmentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const result = await applyBulkPriceAdjustment(parsed.data, session.user.orgId, resolveActorId(session))
    return NextResponse.json(result, { status: parsed.data.dry_run ? 200 : 201 })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'PRICE_LIST_NOT_FOUND') {
      return NextResponse.json({ error: 'Lista de precios no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
