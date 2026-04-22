import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { invoiceSchema, invoiceQuerySchema } from '@/modules/sales/invoice.schema'
import { listInvoices, createInvoice } from '@/modules/sales/invoices.service'

export const GET = withPermission('sales:read', async (req) => {
  const parsed = invoiceQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  const result = await listInvoices(parsed.data)
  return NextResponse.json(result)
})

export const POST = withPermission('sales:write', async (req, _ctx, session) => {
  const body = await req.json()
  const parsed = invoiceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  const invoice = await createInvoice(parsed.data, session.user.orgId!, session.user.id!)
  return NextResponse.json(invoice, { status: 201 })
})
