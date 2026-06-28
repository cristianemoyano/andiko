import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveTenantContext, tenancyErrorResponse } from '@/lib/tenancy'
import { paymentUpdateSchema } from '@/modules/sales/payment.schema'
import { getPayment, updatePayment, deletePayment } from '@/modules/sales/payments.service'

type P = { id: string }

export const GET = withPermission<P>('sales:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const tenantResult = await resolveTenantContext(session.user)
  if ('error' in tenantResult) return tenantResult.error

  try {
    const payment = await getPayment(id, tenantResult.ctx)
    return NextResponse.json(payment)
  } catch (err) {
    const tenancyResp = tenancyErrorResponse(err)
    if (tenancyResp) return tenancyResp
    return NextResponse.json({ error: 'Cobro no encontrado', code: 'NOT_FOUND' }, { status: 404 })
  }
})

export const PATCH = withPermission<P>('sales:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = paymentUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  const tenantResult = await resolveTenantContext(session.user)
  if ('error' in tenantResult) return tenantResult.error

  try {
    const payment = await updatePayment(id, parsed.data, tenantResult.ctx, resolveActorId(session))
    return NextResponse.json(payment)
  } catch (err: unknown) {
    const tenancyResp = tenancyErrorResponse(err)
    if (tenancyResp) return tenancyResp
    if (err instanceof Error && err.message === 'PAYMENT_NOT_FOUND') {
      return NextResponse.json({ error: 'Cobro no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})

export const DELETE = withPermission<P>('sales:delete', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const tenantResult = await resolveTenantContext(session.user)
  if ('error' in tenantResult) return tenantResult.error

  try {
    await deletePayment(id, tenantResult.ctx, resolveActorId(session))
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    const tenancyResp = tenancyErrorResponse(err)
    if (tenancyResp) return tenancyResp
    if (err instanceof Error && err.message === 'PAYMENT_NOT_FOUND') {
      return NextResponse.json({ error: 'Cobro no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
