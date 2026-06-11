import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { makeTenantContext } from '@/lib/tenancy'
import { paymentUpdateSchema } from '@/modules/sales/payment.schema'
import { getPayment, updatePayment, deletePayment } from '@/modules/sales/payments.service'

type P = { id: string }

export const GET = withPermission<P>('sales:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const tenantCtx = await makeTenantContext(session.user)
    const payment = await getPayment(id, tenantCtx)
    return NextResponse.json(payment)
  } catch {
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
  try {
    const payment = await updatePayment(id, parsed.data, resolveActorId(session))
    return NextResponse.json(payment)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'PAYMENT_NOT_FOUND') {
      return NextResponse.json({ error: 'Cobro no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})

export const DELETE = withPermission<P>('sales:delete', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    await deletePayment(id, resolveActorId(session))
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'PAYMENT_NOT_FOUND') {
      return NextResponse.json({ error: 'Cobro no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
