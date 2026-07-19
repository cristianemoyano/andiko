import Decimal from 'decimal.js'
import type { CartLine, CartContext, CampaignRule, CampaignPaymentRuleData } from './campaign-resolver.types'

export interface CampaignMatch {
  applies: boolean
  qualifyingLineIds: string[]
  reason: string
}

function timeToMinutes(t: string): number {
  const [h, m] = t.slice(0, 5).split(':').map((n) => parseInt(n, 10))
  return (h || 0) * 60 + (m || 0)
}

function withinTimeWindow(from: string | null, to: string | null, at: Date): boolean {
  if (!from || !to) return true
  const now = at.getHours() * 60 + at.getMinutes()
  const start = timeToMinutes(from)
  const end = timeToMinutes(to)
  // Ventana normal (start <= end) o que cruza medianoche (start > end).
  return start <= end ? now >= start && now <= end : now >= start || now <= end
}

/** Suma bruta del carrito (cantidad × precio), sin descuentos, para el umbral mínimo. */
export function cartGrossSubtotal(lines: CartLine[]): string {
  return lines
    .reduce((acc, l) => acc.plus(new Decimal(l.quantity).mul(l.unit_price)), new Decimal(0))
    .toFixed(2)
}

/** Una fila de condición de pago matchea si todos sus campos no-nulos coinciden con el carrito. */
export function paymentRuleMatches(rule: CampaignPaymentRuleData, cart: CartContext): boolean {
  if (rule.payment_method && rule.payment_method !== cart.payment_method) return false
  if (rule.payment_condition && rule.payment_condition !== cart.payment_condition) return false
  if (rule.wallet && rule.wallet !== cart.wallet) return false
  if (rule.card_brand && rule.card_brand !== cart.card_brand) return false
  if (rule.card_type && rule.card_type !== cart.card_type) return false
  if (rule.via_qr === true && cart.via_qr !== true) return false
  return true
}

function lineMatchesTarget(
  line: CartLine,
  target: { target_kind: string; category_id: string | null; product_id: string | null; variant_id: string | null },
): boolean {
  if (target.target_kind === 'category') return !!line.category_id && line.category_id === target.category_id
  if (target.target_kind === 'product') return !!line.product_id && line.product_id === target.product_id
  if (target.target_kind === 'variant') return !!line.variant_id && line.variant_id === target.variant_id
  return false
}

/** Líneas que califican tras aplicar inclusiones/exclusiones. Sin targets → todas. */
export function qualifyingLineIds(rule: CampaignRule, lines: CartLine[]): string[] {
  const inclusions = rule.targets.filter((t) => !t.is_exclusion)
  const exclusions = rule.targets.filter((t) => t.is_exclusion)

  return lines
    .filter((line) => {
      const included = inclusions.length === 0 || inclusions.some((t) => lineMatchesTarget(line, t))
      if (!included) return false
      const excluded = exclusions.some((t) => lineMatchesTarget(line, t))
      return !excluded
    })
    .map((l) => l.line_id)
}

/**
 * Evalúa si una campaña aplica a un carrito y a qué líneas.
 * Núcleo puro (sin DB) — foco de tests. La vigencia por fecha y el estado activo
 * se asumen ya filtrados por el loader; aquí se re-chequea fecha por robustez y
 * se evalúan weekday/hora/canal/pago/mínimo/sucursal/targets.
 */
export function evaluateCampaign(rule: CampaignRule, lines: CartLine[], cart: CartContext): CampaignMatch {
  const noMatch = (reason: string): CampaignMatch => ({ applies: false, qualifyingLineIds: [], reason })

  const at = cart.at
  if (at < rule.valid_from || at > rule.valid_to) return noMatch('Fuera de vigencia')

  if (rule.active_weekdays && rule.active_weekdays.length > 0 && !rule.active_weekdays.includes(at.getDay())) {
    return noMatch('No aplica en este día de la semana')
  }

  if (!withinTimeWindow(rule.active_time_from, rule.active_time_to, at)) {
    return noMatch('Fuera de la franja horaria')
  }

  if (rule.channels && rule.channels.length > 0 && !rule.channels.includes(cart.channel)) {
    return noMatch('No aplica en este canal')
  }

  if (rule.branch_id && rule.branch_id !== cart.branch_id) {
    return noMatch('No aplica en esta sucursal')
  }

  if (rule.paymentRules.length > 0 && !rule.paymentRules.some((r) => paymentRuleMatches(r, cart))) {
    return noMatch('No coincide la condición de pago')
  }

  if (rule.min_purchase_amount != null) {
    const subtotal = new Decimal(cartGrossSubtotal(lines))
    if (subtotal.lt(rule.min_purchase_amount)) {
      return noMatch(`Compra mínima de ${rule.min_purchase_amount} no alcanzada`)
    }
  }

  const qualifying = qualifyingLineIds(rule, lines)
  if (qualifying.length === 0) return noMatch('Ningún ítem del carrito califica')

  return { applies: true, qualifyingLineIds: qualifying, reason: 'Aplica' }
}
