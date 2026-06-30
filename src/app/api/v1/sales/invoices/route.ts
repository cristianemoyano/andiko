import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { resolveTenantContext } from '@/lib/tenancy'
import { invoiceSchema, invoiceQuerySchema } from '@/modules/sales/invoice.schema'
import { listInvoices, createInvoice } from '@/modules/sales/invoices.service'
import { saleLineItemValidationResponse } from '@/lib/sales-route-errors'

export const GET = withPermission('sales:read', async (req, _ctx, session) => {
  const parsed = invoiceQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }

  const tenantResult = await resolveTenantContext(session.user)
  if ('error' in tenantResult) return tenantResult.error

  const result = await listInvoices(parsed.data, tenantResult.ctx)
  return NextResponse.json(result)
})

export const POST = withPermission('sales:write', async (req, _ctx, session) => {
  const body = await req.json()
  const parsed = invoiceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error

  try {
    const invoice = await createInvoice(parsed.data, orgScope.orgId, resolveActorId(session))
    return NextResponse.json(invoice, { status: 201 })
  } catch (err: unknown) {
    const lineErr = saleLineItemValidationResponse(err)
    if (lineErr) return lineErr
    if (err instanceof Error) {
      if (err.message === 'ORDER_NOT_FOUND')     return NextResponse.json({ error: 'Pedido no encontrado', code: 'ORDER_NOT_FOUND' }, { status: 404 })
      if (err.message === 'ORDER_NOT_DELIVERED') return NextResponse.json({ error: 'El pedido debe estar entregado para generar una factura', code: 'ORDER_NOT_DELIVERED' }, { status: 409 })
      if (err.message === 'ORDER_CONTACT_REQUIRED') return NextResponse.json({ error: 'El pedido debe tener cliente asignado para facturar', code: 'ORDER_CONTACT_REQUIRED' }, { status: 422 })
      if (err.message === 'BRANCH_NOT_FOUND')    return NextResponse.json({ error: 'Sucursal no encontrada o inactiva', code: 'BRANCH_NOT_FOUND' }, { status: 404 })
      if (err.message === 'ORG_CONTEXT_REQUIRED') return NextResponse.json({ error: 'Falta contexto de organización o sucursal', code: 'ORG_CONTEXT_REQUIRED' }, { status: 422 })
    }
    throw err
  }
})
