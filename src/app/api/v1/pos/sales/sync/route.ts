import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Op } from 'sequelize'
import { withPosDevice } from '@/lib/pos-auth'
import SalesOrder from '@/modules/sales/sales-order.model'
import { posSaleAuthorizeSchema } from '@/modules/pos/pos-fiscal.schema'
import { upsertPosSalesOrder } from '@/modules/pos/pos-sales-sync.service'
import { finalizePosSaleInErp } from '@/modules/pos/pos-sales-finalize.service'

const bodySchema = z.object({
  sales: z.array(posSaleAuthorizeSchema).min(1).max(100),
})

const pullQuerySchema = z.object({
  since: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
})

export const GET = withPosDevice(async (req: NextRequest, ctx) => {
  const parsed = pullQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }

  const since = parsed.data.since ? new Date(parsed.data.since) : new Date(0)
  const orders = await SalesOrder.findAll({
    where: {
      org_id: ctx.orgId,
      pos_device_id: ctx.deviceId,
      source: 'pos',
      updated_at: { [Op.gte]: since },
    },
    attributes: ['id', 'pos_sale_id', 'order_number', 'total', 'created_at', 'updated_at'],
    order: [['updated_at', 'ASC']],
    limit: parsed.data.limit,
  })

  return NextResponse.json({
    data: orders.map(o => ({
      pos_sale_id: o.pos_sale_id,
      cloud_id: o.id,
      order_number: o.order_number,
      total: o.total,
      sold_at: o.created_at.toISOString(),
      updated_at: o.updated_at.toISOString(),
    })),
  })
})

export const POST = withPosDevice(async (req: NextRequest, ctx) => {
  const body = await req.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  const results: Array<{ pos_sale_id: string; cloud_id: string | null; error: string | null }> = []

  for (const sale of parsed.data.sales) {
    try {
      const order = await upsertPosSalesOrder(ctx, sale)
      if (order.afip_status === 'authorized' && order.cae) {
        await finalizePosSaleInErp(order.id, ctx.orgId, { payments: sale.payments })
      }
      results.push({ pos_sale_id: sale.pos_sale_id, cloud_id: order.id, error: null })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      results.push({ pos_sale_id: sale.pos_sale_id, cloud_id: null, error: msg })
    }
  }

  const failed = results.filter((r) => r.error !== null).length
  return NextResponse.json({ results, synced: results.length - failed, failed }, { status: 200 })
})
