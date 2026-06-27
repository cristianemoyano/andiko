import { NextResponse } from 'next/server'
import { requireSysAdmin } from '@/lib/sys-admin-guard'
import { generateInvoiceSchema, billingInvoiceQuerySchema } from '@/modules/billing/billing-invoice.schema'
import { listBillingInvoices, generateInvoiceForPeriod } from '@/modules/billing/billing-invoices.service'
import { billingErrorResponse } from '@/modules/billing/billing.errors'

export async function GET(req: Request) {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  const url = new URL(req.url)
  const parsed = billingInvoiceQuerySchema.safeParse(Object.fromEntries(url.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }

  const result = await listBillingInvoices(parsed.data)
  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = generateInvoiceSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const invoice = await generateInvoiceForPeriod(parsed.data, gate.session.user!.id as string)
    return NextResponse.json(invoice, { status: 201 })
  } catch (err) {
    const mapped = billingErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}
