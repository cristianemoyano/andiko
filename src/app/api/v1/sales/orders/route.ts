import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { salesOrderSchema, salesOrderQuerySchema } from '@/modules/sales/sales-order.schema'
import { listOrders, createOrder } from '@/modules/sales/sales-orders.service'

export const GET = withPermission('sales:read', async (req) => {
  const parsed = salesOrderQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  const result = await listOrders(parsed.data)
  return NextResponse.json(result)
})

export const POST = withPermission('sales:write', async (req, _ctx, session) => {
  const body = await req.json()
  const parsed = salesOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  const order = await createOrder(parsed.data, session.user.orgId!, session.user.id!)
  return NextResponse.json(order, { status: 201 })
})
