import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSysAdmin } from '@/lib/sys-admin-guard'
import { getBillingInvoice, issueBillingInvoice, voidBillingInvoice } from '@/modules/billing/billing-invoices.service'
import { billingErrorResponse } from '@/modules/billing/billing.errors'

type P = { id: string }

const actionSchema = z.object({ action: z.enum(['issue', 'void']) })

export async function GET(_req: Request, ctx: { params: Promise<P> }) {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  const { id } = await ctx.params
  try {
    const invoice = await getBillingInvoice(id)
    return NextResponse.json(invoice)
  } catch (err) {
    const mapped = billingErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<P> }) {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  const { id } = await ctx.params
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = actionSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  const actorId = gate.session.user!.id as string
  try {
    const invoice = parsed.data.action === 'issue'
      ? await issueBillingInvoice(id, actorId)
      : await voidBillingInvoice(id, actorId)
    return NextResponse.json(invoice)
  } catch (err) {
    const mapped = billingErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
}
