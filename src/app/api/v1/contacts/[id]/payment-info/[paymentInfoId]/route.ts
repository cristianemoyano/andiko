import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { TenancyError, TENANCY_ERROR_CODES, resolveTenantContext } from '@/lib/tenancy'
import { contactPaymentInfoUpdateSchema } from '@/modules/contacts/contact-payment-info.schema'
import { updatePaymentInfo, deletePaymentInfo } from '@/modules/contacts/contact-payment-info.service'

type P = { id: string; paymentInfoId: string }

export const PATCH = withPermission<P>('contacts:write', async (req, ctx, session) => {
  const { paymentInfoId } = await ctx.params
  const body = await req.json()
  const parsed = contactPaymentInfoUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const ctxTenantResult = await resolveTenantContext(session.user)
    if ('error' in ctxTenantResult) return ctxTenantResult.error
    const ctxTenant = ctxTenantResult.ctx
    const item = await updatePaymentInfo(paymentInfoId, parsed.data, ctxTenant, resolveActorId(session))
    return NextResponse.json(item.toJSON())
  } catch (err) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    if (err instanceof Error && err.message === 'PAYMENT_INFO_NOT_FOUND') {
      return NextResponse.json({ error: 'Dato de pago no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    if (err instanceof Error && err.message.includes('unique')) {
      return NextResponse.json({ error: 'El CBU ya está registrado', code: 'DUPLICATE_CBU' }, { status: 409 })
    }
    throw err
  }
})

export const DELETE = withPermission<P>('contacts:delete', async (_req, ctx, session) => {
  const { paymentInfoId } = await ctx.params
  try {
    const ctxTenantResult = await resolveTenantContext(session.user)
    if ('error' in ctxTenantResult) return ctxTenantResult.error
    const ctxTenant = ctxTenantResult.ctx
    await deletePaymentInfo(paymentInfoId, ctxTenant, resolveActorId(session))
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    if (err instanceof Error && err.message === 'PAYMENT_INFO_NOT_FOUND') {
      return NextResponse.json({ error: 'Dato de pago no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
