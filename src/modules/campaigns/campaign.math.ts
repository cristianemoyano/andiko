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
