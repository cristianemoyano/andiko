import { NextRequest, NextResponse } from 'next/server'
import { withPosDevice } from '@/lib/pos-auth'
import { tenantContextFromPosDevice } from '@/lib/tenancy'
import { createSalesReturnSchema } from '@/modules/sales/sales-return.schema'
import { createReturnFromOrder, completeReturn } from '@/modules/sales/sales-returns.service'
import SalesOrder from '@/modules/sales/sales-order.model'

/** POS return/exchange — idempotent via pos_local_id, completes in one call. */
export const POST = withPosDevice(async (req: NextRequest, deviceCtx) => {
  const segments = req.nextUrl.pathname.split('/')
  const orderId = segments[segments.length - 2]
  if (!orderId) {
    return NextResponse.json({ error: 'orderId required', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 }) }

  const parsed = createSalesReturnSchema.safeParse({ ...(body as object), order_id: orderId })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const baseCtx = tenantContextFromPosDevice(deviceCtx)
    const orderActor = await SalesOrder.findOne({
      where: { id: orderId, org_id: baseCtx.orgId },
      attributes: ['salesperson_id'],
    })
    const tenantCtx = {
      ...baseCtx,
      userId: orderActor?.salesperson_id ?? '',
    }
    const created = await createReturnFromOrder(parsed.data, tenantCtx)
    if (!created) throw new Error('SALES_RETURN_CREATE_FAILED')
    const completed = await completeReturn(created.id, {
      refund_disposition: (body as { refund_disposition?: 'account_credit' | 'cash_refund' }).refund_disposition ?? 'account_credit',
      refund_method: (body as { refund_method?: 'cash' }).refund_method,
      refund_amount: (body as { refund_amount?: number }).refund_amount,
    }, tenantCtx)
    return NextResponse.json(completed, { status: 201 })
  } catch (err) {
    if (err instanceof Error) {
      const map: Record<string, number> = {
        ORDER_NOT_FOUND: 404,
        ORDER_NOT_RETURNABLE: 422,
        ORDER_ITEM_NOT_FOUND: 422,
        RETURN_QUANTITY_EXCEEDS_AVAILABLE: 422,
        INSUFFICIENT_STOCK: 422,
        POS_BRANCH_REQUIRED: 422,
        WAREHOUSE_REQUIRED: 422,
      }
      if (map[err.message]) {
        return NextResponse.json({ error: err.message, code: err.message }, { status: map[err.message] })
      }
    }
    throw err
  }
})
