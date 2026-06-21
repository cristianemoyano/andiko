import { NextRequest, NextResponse } from 'next/server'
import { withPosDevice } from '@/lib/pos-auth'
import { posSaleAuthorizeSchema } from '@/modules/pos/pos-fiscal.schema'
import { upsertPosSalesOrder } from '@/modules/pos/pos-sales-sync.service'

/** Registers a POS sale in cloud (sales_order) without requesting AFIP CAE. */
export const POST = withPosDevice(async (req: NextRequest, ctx) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 })
  }

  const parsed = posSaleAuthorizeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  try {
    const order = await upsertPosSalesOrder(ctx, parsed.data)
    return NextResponse.json({
      pos_sale_id: order.pos_sale_id!,
      cloud_id: order.id,
      afip_status: order.afip_status,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message === 'POS_BRANCH_REQUIRED') {
      return NextResponse.json({ error: 'El dispositivo POS no tiene sucursal asignada', code: message }, { status: 422 })
    }
    throw err
  }
})
