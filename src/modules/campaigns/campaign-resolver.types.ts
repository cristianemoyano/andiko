import type { IvaRate } from '@/types'
import type { DocumentTotals } from '@/modules/sales/sales.math'
import type {
  CampaignRewardKind,
  CampaignChannel,
  CampaignEffectKind,
  CampaignWarningCode,
} from './campaign.constants'
import type { CampaignCardBrand, CampaignCardType, CampaignWallet } from './campaign.constants'
import type { PaymentMethod } from '@/modules/sales/payment.constants'
import type { PaymentCondition } from '@/types'

/** Línea de carrito normalizada sobre la que opera el resolver (agnóstica del documento). */
export interface CartLine {
  line_id: string
  product_id: string | null
  variant_id: string | null
  category_id: string | null
  /** Marca del producto (de `product.vendor`); usada por targets de tipo `brand`. */
  brand: string | null
  quantity: string
  unit_price: string
  discount_pct: string
  iva_rate: IvaRate
}

/** Contexto del carrito: cómo/dónde/cuándo se paga. */
export interface CartContext {
  branch_id: string | null
  contact_id: string | null
  channel: CampaignChannel
  payment_method: PaymentMethod | null
  payment_condition: PaymentCondition | null
  wallet: CampaignWallet | null
  card_brand: CampaignCardBrand | null
  card_type: CampaignCardType | null
  via_qr: boolean | null
  coupon_codes: string[]
  /** Fecha de referencia (para weekday/hora); default: ahora. */
  at: Date
}

/** Condición de producto (inclusión/exclusión), en forma pura. */
export interface CampaignTargetRule {
  target_kind: 'category' | 'product' | 'variant' | 'brand'
  category_id: string | null
  product_id: string | null
  variant_id: string | null
  brand: string | null
  is_exclusion: boolean
}

/** Condición de pago, en forma pura (una fila = una combinación; varias = OR). */
export interface CampaignPaymentRuleData {
  payment_method: PaymentMethod | null
  payment_condition: PaymentCondition | null
  wallet: CampaignWallet | null
  card_brand: CampaignCardBrand | null
  card_type: CampaignCardType | null
  via_qr: boolean | null
}

/** Campaña en forma pura para el matcher/resolver (sin dependencia de Sequelize). */
export interface CampaignRule {
  id: string
  name: string
  branch_id: string | null
  reward_kind: CampaignRewardKind
  reward_percent: string | null
  installments_count: number | null
  installments_interest_free: boolean | null
  requires_coupon: boolean
  stackable: boolean
  priority: number
  min_purchase_amount: string | null
  valid_from: Date
  valid_to: Date
  active_weekdays: number[] | null
  active_time_from: string | null
  active_time_to: string | null
  channels: CampaignChannel[] | null
  targets: CampaignTargetRule[]
  paymentRules: CampaignPaymentRuleData[]
  /** Id del cupón que habilitó la campaña (si `requires_coupon`). */
  couponId?: string | null
}

export interface CampaignEffect {
  campaign_id: string
  campaign_name: string
  coupon_id?: string | null
  line_id?: string
  effect_kind: CampaignEffectKind
  /** Porcentaje o monto según `effect_kind`. */
  value: string
  reason: string
}

/** Beneficio no monetario (ej. cuotas sin interés). */
export interface CampaignBenefit {
  campaign_id: string
  campaign_name: string
  kind: 'installments'
  installments_count: number
  interest_free: boolean
  reason: string
}

export interface PendingApplication {
  campaign_id: string
  coupon_id: string | null
  applied_discount_amount: string
  benefit_snapshot: string | null
  rule_snapshot: Record<string, unknown>
}

export interface ResolveResult {
  effects: CampaignEffect[]
  benefits: CampaignBenefit[]
  adjustedLines: CartLine[]
  totalsBefore: DocumentTotals
  totalsAfter: DocumentTotals
  applications: PendingApplication[]
  warnings: CampaignWarningCode[]
}
