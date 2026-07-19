import Decimal from 'decimal.js'
import { calcLineItem, calcDocumentTotals } from '@/modules/sales/sales.math'
import { mergeDiscountPct } from './campaign.math'
import { evaluateCampaign } from './campaign-match'
import { CAMPAIGN_WARNINGS, type CampaignMergePolicy } from './campaign.constants'
import type {
  CartLine,
  CartContext,
  CampaignRule,
  ResolveResult,
  CampaignEffect,
  CampaignBenefit,
  PendingApplication,
} from './campaign-resolver.types'

function lineDiscountAmount(line: CartLine): Decimal {
  return new Decimal(calcLineItem(line.quantity, line.unit_price, line.discount_pct, line.iva_rate).discount_amount)
}

function totalsOf(lines: CartLine[]) {
  return calcDocumentTotals(lines.map((l) => calcLineItem(l.quantity, l.unit_price, l.discount_pct, l.iva_rate)))
}

/**
 * Resolución pura: aplica las campañas ya cargadas (y ya habilitadas por cupón/estado)
 * a un carrito, produciendo efectos porcentuales por línea, beneficios (cuotas),
 * totales antes/después y las aplicaciones a registrar. Sin DB — foco de tests.
 */
export function resolveCampaigns(
  campaigns: CampaignRule[],
  lines: CartLine[],
  cart: CartContext,
  policy: CampaignMergePolicy,
): ResolveResult {
  const adjustedLines: CartLine[] = lines.map((l) => ({ ...l }))
  const byId = new Map(adjustedLines.map((l) => [l.line_id, l]))

  const effects: CampaignEffect[] = []
  const benefits: CampaignBenefit[] = []
  const applications: PendingApplication[] = []
  const warnings = new Set<string>()

  const lockedLines = new Set<string>() // tocadas por una campaña NO acumulable
  const touchedLines = new Set<string>() // tocadas por cualquier campaña

  const ordered = [...campaigns].sort((a, b) => a.priority - b.priority)

  for (const campaign of ordered) {
    const match = evaluateCampaign(campaign, adjustedLines, cart)
    if (!match.applies) continue

    if (campaign.reward_kind === 'installments' && campaign.installments_count) {
      const reason = `${campaign.installments_count} cuotas${campaign.installments_interest_free ? ' sin interés' : ''}`
      benefits.push({
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        kind: 'installments',
        installments_count: campaign.installments_count,
        interest_free: !!campaign.installments_interest_free,
        reason,
      })
      applications.push({
        campaign_id: campaign.id,
        coupon_id: campaign.couponId ?? null,
        applied_discount_amount: '0.00',
        benefit_snapshot: reason,
        rule_snapshot: { reward_kind: 'installments', installments_count: campaign.installments_count, interest_free: !!campaign.installments_interest_free },
      })
      continue
    }

    if (campaign.reward_kind !== 'percent' || campaign.reward_percent == null) continue

    // Selección de líneas elegibles según stacking.
    const eligible = match.qualifyingLineIds.filter((id) => {
      if (lockedLines.has(id)) return false
      if (!campaign.stackable && touchedLines.has(id)) return false
      return true
    })
    if (eligible.length === 0) continue

    let campaignDiscount = new Decimal(0)
    const changedLines: string[] = []
    for (const id of eligible) {
      const line = byId.get(id)
      if (!line) continue
      const merged = mergeDiscountPct(line.discount_pct, campaign.reward_percent, policy)
      // Si la campaña no supera el descuento ya presente en la línea, no la toca:
      // no muta, no emite efecto, no bloquea (evita inflar usos y tapar a otra mejor).
      if (!new Decimal(merged.pct).gt(line.discount_pct || 0)) continue

      const before = lineDiscountAmount(line)
      line.discount_pct = merged.pct
      const after = lineDiscountAmount(line)
      campaignDiscount = campaignDiscount.plus(after.minus(before))
      if (merged.doubled) warnings.add(CAMPAIGN_WARNINGS.DOUBLE_DISCOUNT_ON_LINE)

      effects.push({
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        coupon_id: campaign.couponId ?? null,
        line_id: id,
        effect_kind: 'line_discount_pct',
        value: campaign.reward_percent,
        reason: `${campaign.name}: ${campaign.reward_percent}%`,
      })

      changedLines.push(id)
      touchedLines.add(id)
      if (!campaign.stackable) lockedLines.add(id)
    }

    // Solo registrar la aplicación (y consumir un uso) si la campaña efectivamente descontó algo.
    if (changedLines.length === 0) continue

    applications.push({
      campaign_id: campaign.id,
      coupon_id: campaign.couponId ?? null,
      applied_discount_amount: campaignDiscount.toFixed(2),
      benefit_snapshot: null,
      rule_snapshot: { reward_kind: 'percent', reward_percent: campaign.reward_percent, lines: changedLines },
    })
  }

  return {
    effects,
    benefits,
    adjustedLines,
    totalsBefore: totalsOf(lines),
    totalsAfter: totalsOf(adjustedLines),
    applications,
    warnings: [...warnings] as ResolveResult['warnings'],
  }
}
