import Decimal from 'decimal.js'
import type { CampaignMergePolicy } from './campaign.constants'

export interface MergeDiscountResult {
  /** Descuento porcentual resultante (0–100), con 2 decimales. */
  pct: string
  /** true si tanto el descuento manual como el de campaña eran > 0 (posible doble descuento). */
  doubled: boolean
}

/**
 * Combina el descuento manual de una línea con el de una campaña según la política.
 * Núcleo puro (sin DB) — foco de tests.
 */
export function mergeDiscountPct(
  manualPct: string | number,
  campaignPct: string | number,
  policy: CampaignMergePolicy,
): MergeDiscountResult {
  const manual = new Decimal(manualPct || 0)
  const campaign = new Decimal(campaignPct || 0)
  const doubled = manual.gt(0) && campaign.gt(0)

  let result: Decimal
  switch (policy) {
    case 'max':
      result = Decimal.max(manual, campaign)
      break
    case 'add_capped':
      result = Decimal.min(new Decimal(100), manual.plus(campaign))
      break
    case 'replace':
      result = campaign
      break
    default:
      result = Decimal.max(manual, campaign)
  }

  // Nunca por debajo del descuento manual ya pactado, ni fuera de [0, 100].
  result = Decimal.max(result, manual)
  result = Decimal.min(new Decimal(100), Decimal.max(new Decimal(0), result))

  return { pct: result.toFixed(2), doubled }
}

/**
 * Monto fijo → % uniforme por línea. Prorratear un monto fijo proporcionalmente a la base
 * de cada línea equivale a un mismo porcentaje: `pct = monto / baseTotal · 100` (topado a 100).
 * Así el descuento se expresa como `discount_pct` por línea y no toca la matemática de totales.
 */
export function fixedAmountToPct(rewardAmount: string | number, totalBase: string | number): string {
  const amount = new Decimal(rewardAmount || 0)
  const base = new Decimal(totalBase || 0)
  if (base.lte(0)) return '0.00'
  return Decimal.min(new Decimal(100), amount.div(base).mul(100)).toFixed(2)
}

/**
 * 2x1 / "lleva X paga Y" → % equivalente por línea. Por cada grupo de `buy + get` unidades,
 * `get` salen gratis. El valor de las unidades gratis sobre el total de la línea es el descuento:
 * `pct = unidadesGratis / cantidad · 100`.
 */
export function bogoPct(quantity: string | number, buyQty: string | number, getQty: string | number): string {
  const qty = new Decimal(quantity || 0)
  const buy = new Decimal(buyQty || 0)
  const get = new Decimal(getQty || 0)
  const group = buy.plus(get)
  if (qty.lte(0) || group.lte(0)) return '0.00'
  const freeUnits = qty.div(group).floor().mul(get)
  if (freeUnits.lte(0)) return '0.00'
  return Decimal.min(new Decimal(100), freeUnits.div(qty).mul(100)).toFixed(2)
}
