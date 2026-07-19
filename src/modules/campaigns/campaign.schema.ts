import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import { PAYMENT_METHODS } from '@/modules/sales/payment.constants'
import { PAYMENT_CONDITIONS, IVA_RATES, type PaymentCondition, type IvaRate } from '@/types'
import {
  CAMPAIGN_REWARD_KINDS,
  CAMPAIGN_CHANNELS,
  CAMPAIGN_TARGET_KINDS,
  CAMPAIGN_WALLETS,
  CAMPAIGN_CARD_BRANDS,
  CAMPAIGN_CARD_TYPES,
  WEEKDAY_MIN,
  WEEKDAY_MAX,
} from './campaign.constants'

const paymentConditionEnum = z.enum(PAYMENT_CONDITIONS as unknown as [PaymentCondition, ...PaymentCondition[]])
const ivaRateEnum = z.enum(IVA_RATES as unknown as [IvaRate, ...IvaRate[]])

const percent = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Porcentaje inválido')
const money = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Monto inválido')
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (HH:MM)')

export const campaignTargetInputSchema = z.object({
  target_kind:  z.enum(CAMPAIGN_TARGET_KINDS),
  category_id:  z.string().uuid().nullable().optional(),
  product_id:   z.string().uuid().nullable().optional(),
  variant_id:   z.string().uuid().nullable().optional(),
  brand:        z.string().min(1).max(120).nullable().optional(),
  is_exclusion: z.boolean().optional().default(false),
}).refine(
  (t) => {
    const refs = [t.category_id, t.product_id, t.variant_id, t.brand].filter(Boolean).length
    if (refs !== 1) return false
    if (t.target_kind === 'category') return !!t.category_id
    if (t.target_kind === 'product') return !!t.product_id
    if (t.target_kind === 'variant') return !!t.variant_id
    return !!t.brand
  },
  { message: 'La condición de producto debe referenciar exactamente el valor que corresponde a su tipo.' },
)

export const campaignPaymentRuleInputSchema = z.object({
  payment_method:    z.enum(PAYMENT_METHODS).nullable().optional(),
  payment_condition: paymentConditionEnum.nullable().optional(),
  wallet:            z.enum(CAMPAIGN_WALLETS).nullable().optional(),
  card_brand:        z.enum(CAMPAIGN_CARD_BRANDS).nullable().optional(),
  card_type:         z.enum(CAMPAIGN_CARD_TYPES).nullable().optional(),
  via_qr:            z.boolean().nullable().optional(),
}).refine(
  (r) => Boolean(
    r.payment_method || r.payment_condition || r.wallet || r.card_brand || r.card_type || r.via_qr,
  ),
  { message: 'La condición de pago debe definir al menos un criterio.' },
)

const campaignBaseSchema = z.object({
  name:                       z.string().min(1).max(120),
  description:                z.string().max(2000).nullable().optional(),
  terms:                      z.string().max(4000).nullable().optional(),
  branch_id:                  z.string().uuid().nullable().optional(),
  reward_kind:                z.enum(CAMPAIGN_REWARD_KINDS),
  reward_percent:             percent.nullable().optional(),
  installments_count:         z.number().int().positive().max(48).nullable().optional(),
  installments_interest_free: z.boolean().nullable().optional(),
  requires_coupon:            z.boolean().optional().default(false),
  stackable:                  z.boolean().optional().default(false),
  priority:                   z.number().int().min(0).max(1000).optional().default(100),
  min_purchase_amount:        money.nullable().optional(),
  valid_from:                 z.string().datetime({ offset: true }),
  valid_to:                   z.string().datetime({ offset: true }),
  active_weekdays:            z.array(z.number().int().min(WEEKDAY_MIN).max(WEEKDAY_MAX)).max(7).nullable().optional(),
  active_time_from:           time.nullable().optional(),
  active_time_to:             time.nullable().optional(),
  channels:                   z.array(z.enum(CAMPAIGN_CHANNELS)).max(3).nullable().optional(),
  is_active:                  z.boolean().optional().default(true),
  max_uses:                   z.number().int().min(0).nullable().optional(),
  targets:                    z.array(campaignTargetInputSchema).max(200).optional(),
  payment_rules:              z.array(campaignPaymentRuleInputSchema).max(50).optional(),
})

function refineRewardCoherence(data: {
  reward_kind: string
  reward_percent?: string | null
  installments_count?: number | null
}): boolean {
  if (data.reward_kind === 'percent') return data.reward_percent != null
  if (data.reward_kind === 'installments') return data.installments_count != null
  return true
}

export const campaignSchema = campaignBaseSchema
  .refine((d) => new Date(d.valid_to) > new Date(d.valid_from), {
    message: 'La fecha de fin debe ser posterior a la de inicio.',
    path: ['valid_to'],
  })
  .refine(refineRewardCoherence, {
    message: 'El premio no es coherente con el tipo elegido (porcentaje o cuotas).',
    path: ['reward_kind'],
  })

export const campaignUpdateSchema = campaignBaseSchema.partial().refine(
  (d) => !d.valid_from || !d.valid_to || new Date(d.valid_to) > new Date(d.valid_from),
  { message: 'La fecha de fin debe ser posterior a la de inicio.', path: ['valid_to'] },
)

export const campaignQuerySchema = paginationSchema.extend({
  search:    z.string().optional(),
  is_active: z.coerce.boolean().optional(),
})

// ---- Carrito para preview / resolución ----

export const cartLineSchema = z.object({
  line_id:      z.string(),
  product_id:   z.string().uuid().nullable().optional(),
  variant_id:   z.string().uuid().nullable().optional(),
  category_id:  z.string().uuid().nullable().optional(),
  quantity:     z.string().regex(/^\d+(\.\d{1,4})?$/, 'Cantidad inválida'),
  unit_price:   money,
  discount_pct: percent.optional().default('0'),
  iva_rate:     ivaRateEnum.optional().default('21'),
})

export const cartContextSchema = z.object({
  branch_id:         z.string().uuid().nullable().optional(),
  contact_id:        z.string().uuid().nullable().optional(),
  channel:           z.enum(CAMPAIGN_CHANNELS).optional().default('manual'),
  payment_method:    z.enum(PAYMENT_METHODS).nullable().optional(),
  payment_condition: paymentConditionEnum.nullable().optional(),
  wallet:            z.enum(CAMPAIGN_WALLETS).nullable().optional(),
  card_brand:        z.enum(CAMPAIGN_CARD_BRANDS).nullable().optional(),
  card_type:         z.enum(CAMPAIGN_CARD_TYPES).nullable().optional(),
  via_qr:            z.boolean().nullable().optional(),
  coupon_codes:      z.array(z.string().max(40)).max(20).optional(),
  at:                z.string().datetime({ offset: true }).optional(),
})

// Sin `campaign_id` ni `campaign` se resuelven todas las campañas activas de la org.
export const previewSchema = z.object({
  campaign_id: z.string().uuid().optional(),
  campaign:    campaignSchema.optional(),
  lines:       z.array(cartLineSchema).min(1),
  cart:        cartContextSchema.optional(),
})

export const analysisSchema = z.object({
  campaign_id: z.string().uuid().optional(),
  campaign:    campaignSchema.optional(),
  window_days: z.coerce.number().int().min(1).max(365).optional(),
})

export type AnalysisInput = z.infer<typeof analysisSchema>
export type CampaignTargetInput = z.infer<typeof campaignTargetInputSchema>
export type CampaignPaymentRuleInput = z.infer<typeof campaignPaymentRuleInputSchema>
export type CampaignInput = z.infer<typeof campaignSchema>
export type CampaignUpdateInput = z.infer<typeof campaignUpdateSchema>
export type CampaignQuery = z.infer<typeof campaignQuerySchema>
export type CartLineInput = z.infer<typeof cartLineSchema>
export type CartContextInput = z.infer<typeof cartContextSchema>
export type PreviewInput = z.infer<typeof previewSchema>
