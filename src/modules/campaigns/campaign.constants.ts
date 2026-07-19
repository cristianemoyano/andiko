// Constantes del módulo de Campañas — client-safe (sin dependencias de servidor).
// Importable desde schemas Zod, modelos Sequelize y UI.

/** Tipo de premio de una campaña (Fase 1). Se ampliará en F2–3 con fixed_amount/bundle_price/free_qty. */
export const CAMPAIGN_REWARD_KINDS = ['percent', 'installments'] as const
export type CampaignRewardKind = typeof CAMPAIGN_REWARD_KINDS[number]

/** Canales de venta sobre los que puede aplicar/excluirse una campaña. */
export const CAMPAIGN_CHANNELS = ['pos', 'online', 'manual'] as const
export type CampaignChannel = typeof CAMPAIGN_CHANNELS[number]

/** Deriva el canal de campaña a partir de `sales_orders.source`. */
export function channelFromSalesSource(source: 'erp' | 'pos' | 'woocommerce'): CampaignChannel {
  if (source === 'pos') return 'pos'
  if (source === 'woocommerce') return 'online'
  return 'manual'
}

/** A qué apunta una condición de producto. */
export const CAMPAIGN_TARGET_KINDS = ['category', 'product', 'variant'] as const
export type CampaignTargetKind = typeof CAMPAIGN_TARGET_KINDS[number]

/** Wallets/billeteras reconocidas para condiciones de pago. */
export const CAMPAIGN_WALLETS = ['mercadopago', 'modo', 'cuenta_dni', 'uala', 'other'] as const
export type CampaignWallet = typeof CAMPAIGN_WALLETS[number]

/** Marcas de tarjeta reconocidas. */
export const CAMPAIGN_CARD_BRANDS = ['visa', 'mastercard', 'amex', 'cabal', 'naranja', 'other'] as const
export type CampaignCardBrand = typeof CAMPAIGN_CARD_BRANDS[number]

/** Tipo de tarjeta. */
export const CAMPAIGN_CARD_TYPES = ['credit', 'debit'] as const
export type CampaignCardType = typeof CAMPAIGN_CARD_TYPES[number]

/**
 * Política de combinación entre el descuento manual de la línea y el de la campaña.
 * - `max`: se toma el mayor de los dos (default — evita acumulación descontrolada).
 * - `add_capped`: se suman y se topan a 100%.
 * - `replace`: la campaña reemplaza al descuento manual.
 */
export const CAMPAIGN_MERGE_POLICIES = ['max', 'add_capped', 'replace'] as const
export type CampaignMergePolicy = typeof CAMPAIGN_MERGE_POLICIES[number]
export const DEFAULT_MERGE_POLICY: CampaignMergePolicy = 'max'

/** Tipo de efecto que una campaña produce sobre el carrito. */
export const CAMPAIGN_EFFECT_KINDS = ['line_discount_pct', 'line_discount_amount', 'doc_discount_amount'] as const
export type CampaignEffectKind = typeof CAMPAIGN_EFFECT_KINDS[number]

/** Tipos de documento sobre los que se registra una aplicación de campaña. */
export const CAMPAIGN_DOCUMENT_TYPES = ['sales_order', 'invoice', 'quote', 'pos_order'] as const
export type CampaignDocumentType = typeof CAMPAIGN_DOCUMENT_TYPES[number]

/**
 * Días de la semana según `Date.getDay()`: 0 = domingo … 6 = sábado.
 * `active_weekdays` almacena estos valores; null = todos los días.
 */
export const WEEKDAY_MIN = 0
export const WEEKDAY_MAX = 6

/** Códigos de advertencia que el resolver puede emitir. */
export const CAMPAIGN_WARNINGS = {
  DOUBLE_DISCOUNT_ON_LINE: 'DOUBLE_DISCOUNT_ON_LINE',
  COUPON_LIMIT_REACHED: 'COUPON_LIMIT_REACHED',
  COUPON_EXPIRED: 'COUPON_EXPIRED',
  COUPON_NOT_FOUND: 'COUPON_NOT_FOUND',
} as const
export type CampaignWarningCode = typeof CAMPAIGN_WARNINGS[keyof typeof CAMPAIGN_WARNINGS]
