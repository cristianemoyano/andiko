import { NextResponse } from 'next/server'
import { withTenantPermission, resolveActorId } from '@/lib/api-handler'
import { couponSchema } from '@/modules/campaigns/coupon.schema'
import { listCoupons, createCoupon } from '@/modules/campaigns/coupon.service'

type P = { id: string }

function mapNotFound(err: unknown): NextResponse | null {
  if (err instanceof Error && err.message === 'CAMPAIGN_NOT_FOUND') {
    return NextResponse.json({ error: 'Campaña no encontrada.', code: 'CAMPAIGN_NOT_FOUND' }, { status: 404 })
  }
  return null
}

export const GET = withTenantPermission<P>('campaigns:read', async (_req, ctx, _session, tenant) => {
  const { id } = await ctx.params
  try {
    const coupons = await listCoupons(id, tenant)
    return NextResponse.json({ data: coupons })
  } catch (err) {
    const nf = mapNotFound(err)
    if (nf) return nf
    throw err
  }
})

export const POST = withTenantPermission<P>('campaigns:write', async (req, ctx, session, tenant) => {
  const { id } = await ctx.params
  const parsed = couponSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  try {
    const coupon = await createCoupon(id, parsed.data, tenant, resolveActorId(session))
    return NextResponse.json(coupon, { status: 201 })
  } catch (err) {
    const nf = mapNotFound(err)
    if (nf) return nf
    if (err instanceof Error && err.message.includes('unique')) {
      return NextResponse.json({ error: 'El código de cupón ya existe.', code: 'DUPLICATE_COUPON_CODE' }, { status: 409 })
    }
    throw err
  }
})
