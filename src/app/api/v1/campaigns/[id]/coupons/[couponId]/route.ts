import { NextResponse } from 'next/server'
import { withTenantPermission, resolveActorId } from '@/lib/api-handler'
import { couponUpdateSchema } from '@/modules/campaigns/coupon.schema'
import { updateCoupon, deleteCoupon } from '@/modules/campaigns/coupon.service'

type P = { id: string; couponId: string }

function notFound(err: unknown): NextResponse | null {
  if (err instanceof Error && err.message === 'COUPON_NOT_FOUND') {
    return NextResponse.json({ error: 'Cupón no encontrado.', code: 'COUPON_NOT_FOUND' }, { status: 404 })
  }
  return null
}

export const PATCH = withTenantPermission<P>('campaigns:write', async (req, ctx, session, tenant) => {
  const { couponId } = await ctx.params
  const parsed = couponUpdateSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  try {
    const coupon = await updateCoupon(couponId, parsed.data, tenant, resolveActorId(session))
    return NextResponse.json(coupon)
  } catch (err) {
    const nf = notFound(err)
    if (nf) return nf
    throw err
  }
})

export const DELETE = withTenantPermission<P>('campaigns:delete', async (_req, ctx, session, tenant) => {
  const { couponId } = await ctx.params
  try {
    await deleteCoupon(couponId, tenant, resolveActorId(session))
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    const nf = notFound(err)
    if (nf) return nf
    throw err
  }
})
