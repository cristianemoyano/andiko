import 'server-only'
import { isModuleEnabled } from '@/modules/auth/organization-settings.service'
import { resolveCampaignsForCart } from './campaign-resolver.service'
import { channelFromSalesSource, type CampaignChannel } from './campaign.constants'
import type { CartContext, ResolveResult } from './campaign-resolver.types'
import type { TenantContext } from '@/lib/tenancy'
import type { IvaRate, PaymentCondition } from '@/types'
import type { PaymentMethod } from '@/modules/sales/payment.constants'

export { commitCampaignApplications, type CommitDocRef } from './campaign-apply.service'

interface SaleLineLike {
  product_id?: string | null
  variant_id?: string | null
  quantity: string | number
  unit_price: string | number
  discount_pct?: string | number | null
  iva_rate?: IvaRate | null
}

export interface SaleCampaignContext {
  branch_id: string | null
  contact_id: string | null
  source?: 'erp' | 'pos' | 'woocommerce'
  channel?: CampaignChannel
  payment_method?: PaymentMethod | null
  payment_condition?: PaymentCondition | null
  wallet?: string | null
  card_brand?: string | null
  card_type?: string | null
  via_qr?: boolean | null
  coupon_codes?: string[]
  at?: Date
}

export interface SaleCampaignResolution {
  discountPctByIndex: Record<number, string>
  result: ResolveResult
}

/**
 * Resuelve campañas activas para las líneas de una venta. Guardado por módulo:
 * si `campaigns` no está habilitado para la org, o ninguna campaña aplica, devuelve `null`
 * y la venta sigue su curso sin cambios. Reutiliza el `discount_pct` por línea existente
 * (política `max` por defecto) → no altera la matemática de totales.
 */
export async function resolveCampaignsForSaleItems(
  items: SaleLineLike[],
  saleCtx: SaleCampaignContext,
  orgId: string,
): Promise<SaleCampaignResolution | null> {
  if (items.length === 0) return null
  if (!(await isModuleEnabled(orgId, 'campaigns'))) return null

  const lines = items.map((it, idx) => ({
    line_id:      String(idx),
    product_id:   it.product_id ?? null,
    variant_id:   it.variant_id ?? null,
    category_id:  null,
    quantity:     String(it.quantity),
    unit_price:   String(it.unit_price),
    discount_pct: String(it.discount_pct ?? 0),
    iva_rate:     (it.iva_rate ?? '21') as IvaRate,
  }))

  const cart: CartContext = {
    branch_id:         saleCtx.branch_id,
    contact_id:        saleCtx.contact_id,
    channel:           saleCtx.channel ?? channelFromSalesSource(saleCtx.source ?? 'erp'),
    payment_method:    saleCtx.payment_method ?? null,
    payment_condition: saleCtx.payment_condition ?? null,
    wallet:            (saleCtx.wallet ?? null) as CartContext['wallet'],
    card_brand:        (saleCtx.card_brand ?? null) as CartContext['card_brand'],
    card_type:         (saleCtx.card_type ?? null) as CartContext['card_type'],
    via_qr:            saleCtx.via_qr ?? null,
    coupon_codes:      saleCtx.coupon_codes ?? [],
    at:                saleCtx.at ?? new Date(),
  }

  const result = await resolveCampaignsForCart(lines, cart, { orgId } as TenantContext)
  if (result.effects.length === 0 && result.benefits.length === 0) return null

  const discountPctByIndex: Record<number, string> = {}
  for (const line of result.adjustedLines) {
    discountPctByIndex[Number(line.line_id)] = line.discount_pct
  }
  return { discountPctByIndex, result }
}
