import Decimal from 'decimal.js'
import type { IvaRate, BillingLineKind } from '@/types'

/** A computed billing line, ready to persist as a billing_invoice_item. */
export interface BillingLineTotals {
  kind: BillingLineKind
  description: string
  quantity: string
  unit_price: string
  iva_rate: IvaRate
  subtotal: string
  tax_base: string
  tax_amount: string
  total: string
}

/** Inputs needed to build the line items for one billing period. */
export interface BillingChargeInput {
  plan: {
    name: string
    base_price: string
    included_seats: number
    per_seat_price: string
  }
  seats: number
  addons: { module_key: string; unit_price: string; enabled: boolean }[]
  usage: { metric_key: string; label: string; unit_label: string | null; unit_price: string; quantity: string }[]
  iva_rate?: IvaRate
}

function makeLine(
  kind: BillingLineKind,
  description: string,
  quantity: Decimal.Value,
  unitPrice: Decimal.Value,
  ivaRate: IvaRate,
): BillingLineTotals {
  const qty       = new Decimal(quantity)
  const price     = new Decimal(unitPrice)
  const ivaFactor = new Decimal(ivaRate).div(100)

  const subtotal   = qty.mul(price)
  const tax_base   = subtotal
  const tax_amount = tax_base.mul(ivaFactor)
  const total      = tax_base.plus(tax_amount)

  return {
    kind,
    description,
    quantity:   qty.toFixed(4),
    unit_price: price.toFixed(2),
    iva_rate:   ivaRate,
    subtotal:   subtotal.toFixed(2),
    tax_base:   tax_base.toFixed(2),
    tax_amount: tax_amount.toFixed(2),
    total:      total.toFixed(2),
  }
}

/**
 * Build the full set of charge lines for a subscription period:
 * base plan + per-seat overage + enabled module add-ons + metered usage.
 * Returns only lines with a non-zero quantity.
 */
export function calcSubscriptionCharges(input: BillingChargeInput): BillingLineTotals[] {
  const ivaRate = input.iva_rate ?? '21'
  const lines: BillingLineTotals[] = []

  // Base plan fee
  lines.push(makeLine('base', `Plan ${input.plan.name}`, 1, input.plan.base_price, ivaRate))

  // Per-seat overage beyond included seats
  const overage = Math.max(0, input.seats - input.plan.included_seats)
  if (overage > 0) {
    lines.push(makeLine('seat', `Usuarios adicionales (${overage})`, overage, input.plan.per_seat_price, ivaRate))
  }

  // Module add-ons
  for (const addon of input.addons) {
    if (!addon.enabled) continue
    if (new Decimal(addon.unit_price).lte(0)) continue
    lines.push(makeLine('module_addon', `Módulo: ${addon.module_key}`, 1, addon.unit_price, ivaRate))
  }

  // Metered usage
  for (const u of input.usage) {
    if (new Decimal(u.quantity).lte(0)) continue
    const unit = u.unit_label ? ` (${u.unit_label})` : ''
    lines.push(makeLine('usage', `Uso: ${u.label}${unit}`, u.quantity, u.unit_price, ivaRate))
  }

  return lines
}

export interface BillingDocumentTotals {
  subtotal: string
  tax_amount: string
  total: string
}

export function calcBillingTotals(lines: BillingLineTotals[]): BillingDocumentTotals {
  const zero       = new Decimal(0)
  const subtotal   = lines.reduce((acc, l) => acc.plus(l.subtotal), zero)
  const tax_amount = lines.reduce((acc, l) => acc.plus(l.tax_amount), zero)
  const total      = lines.reduce((acc, l) => acc.plus(l.total), zero)

  return {
    subtotal:   subtotal.toFixed(2),
    tax_amount: tax_amount.toFixed(2),
    total:      total.toFixed(2),
  }
}
