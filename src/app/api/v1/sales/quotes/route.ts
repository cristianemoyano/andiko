import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { salesQuoteSchema, salesQuoteQuerySchema } from '@/modules/sales/sales-quote.schema'
import { listQuotes, createQuote } from '@/modules/sales/sales-quotes.service'

export const GET = withPermission('sales:read', async (req) => {
  const parsed = salesQuoteQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  const result = await listQuotes(parsed.data)
  return NextResponse.json(result)
})

export const POST = withPermission('sales:write', async (req, _ctx, session) => {
  const body = await req.json()
  const parsed = salesQuoteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  const orgId = session.user.orgId!
  const quote = await createQuote(parsed.data, orgId, session.user.id!)
  return NextResponse.json(quote, { status: 201 })
})
