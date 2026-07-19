import { NextResponse } from 'next/server'
import { withTenantPermission } from '@/lib/api-handler'
import { previewSchema, type CartContextInput, type CartLineInput } from '@/modules/campaigns/campaign.schema'
import { resolveCampaignsForCart, previewCampaign } from '@/modules/campaigns/campaign-resolver.service'
import type { CartLine, CartContext } from '@/modules/campaigns/campaign-resolver.types'
import type { IvaRate } from '@/types'

function toCartLines(lines: CartLineInput[]): CartLine[] {
  return lines.map((l) => ({
    line_id:      l.line_id,
    product_id:   l.product_id ?? null,
    variant_id:   l.variant_id ?? null,
    category_id:  l.category_id ?? null,
    quantity:     l.quantity,
    unit_price:   l.unit_price,
    discount_pct: l.discount_pct ?? '0',
    iva_rate:     (l.iva_rate ?? '21') as IvaRate,
  }))
}

function toCartContext(cart: CartContextInput | undefined): CartContext {
  return {
    branch_id:         cart?.branch_id ?? null,
    contact_id:        cart?.contact_id ?? null,
    channel:           cart?.channel ?? 'manual',
    payment_method:    cart?.payment_method ?? null,
    payment_condition: cart?.payment_condition ?? null,
    wallet:            cart?.wallet ?? null,
    card_brand:        cart?.card_brand ?? null,
    card_type:         cart?.card_type ?? null,
    via_qr:            cart?.via_qr ?? null,
    coupon_codes:      cart?.coupon_codes ?? [],
    at:                cart?.at ? new Date(cart.at) : new Date(),
  }
}

export const POST = withTenantPermission('campaigns:read', async (req, _ctx, _session, tenant) => {
  const parsed = previewSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  const lines = toCartLines(parsed.data.lines)
  const cart = toCartContext(parsed.data.cart)

  try {
    if (parsed.data.campaign) {
      const result = await previewCampaign({ draft: parsed.data.campaign }, lines, cart, tenant)
      return NextResponse.json(result)
    }
    if (parsed.data.campaign_id) {
      const result = await previewCampaign({ id: parsed.data.campaign_id }, lines, cart, tenant)
      return NextResponse.json(result)
    }
    const result = await resolveCampaignsForCart(lines, cart, tenant)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof Error && err.message === 'CAMPAIGN_NOT_FOUND') {
      return NextResponse.json({ error: 'Campaña no encontrada.', code: 'CAMPAIGN_NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
