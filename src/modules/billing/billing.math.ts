import Decimal from 'decimal.js'
import type { IvaRate, BillingLineKind } from '@/types'
import { ORG_MODULE_DEFS } from '@/modules/auth/organization-modules'
import { billingExtraLabel } from './billing-extras'
import { formatSeatCapacitySummary } from './billing-capacity-summary'

function moduleLabel(key: string): string {
  return ORG_MODULE_DEFS.find(d => d.key === key)?.label ?? key
}

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
    included_branches: number
    per_branch_price: string
  }
  /** Active users in the org at billing time. */
  seats: number
  /** Minimum seats committed on the subscription contract (billing floor). */
  contracted_seats: number
  branches: number
  addons: { module_key: string; unit_price: string; enabled: boolean }[]
  extras: { extra_key: string; unit_price: string; enabled: boolean }[]
  usage: {
    metric_key: string
    label: string
    unit_label: string | null
    unit_price: string
    quantity: string
    /** Effective included quantity (plan + subscription extras). */
    included_quantity: string
    /** Included in the plan bundle. */
    plan_included_quantity?: string
    /** Additional included quantity negotiated on the subscription. */
    subscription_extra_included?: string
  }[]
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
 * Build the full set of charge lines for a subscription period.
 * Includes $0 informational lines (capacity summary, included modules/extras)
 * so the invoice documents plan terms vs actual usage transparently.
 */
export function calcSubscriptionCharges(input: BillingChargeInput): BillingLineTotals[] {
  const ivaRate = input.iva_rate ?? '21'
  const lines: BillingLineTotals[] = []

  // Base plan fee
  lines.push(makeLine('base', `Plan ${input.plan.name}`, 1, input.plan.base_price, ivaRate))

  const billableSeats = Math.max(input.seats, input.contracted_seats)

  // Capacity snapshot — plan vs active users vs contractual commitment
  const seatSummary = formatSeatCapacitySummary({
    active: input.seats,
    contracted: input.contracted_seats,
    includedInPlan: input.plan.included_seats,
  })
  lines.push(makeLine('adjustment', `Capacidad — Usuarios: ${seatSummary}`, 1, 0, ivaRate))
  lines.push(makeLine(
    'adjustment',
    `Capacidad — Sucursales: ${input.branches} activas · ${input.plan.included_branches} incluidas en plan`,
    1,
    0,
    ivaRate,
  ))

  // Per-seat overage beyond included seats (uses contractual floor)
  const seatOverage = Math.max(0, billableSeats - input.plan.included_seats)
  if (seatOverage > 0) {
    const included = input.plan.included_seats
    const basis = billableSeats > input.seats
      ? `${seatOverage} por encima de los ${included} incluidos (${billableSeats} en contrato, ${input.seats} activos)`
      : `${seatOverage} por encima de los ${included} incluidos (${billableSeats} activos)`
    lines.push(makeLine(
      'seat',
      `Usuarios adicionales (${basis})`,
      seatOverage,
      input.plan.per_seat_price,
      ivaRate,
    ))
  }

  // Per-branch overage beyond included branches
  const branchOverage = Math.max(0, input.branches - input.plan.included_branches)
  if (branchOverage > 0) {
    lines.push(makeLine(
      'branch',
      `Sucursales adicionales (${branchOverage} facturadas de ${input.branches} activas)`,
      branchOverage,
      input.plan.per_branch_price,
      ivaRate,
    ))
  }

  // All enabled module add-ons — included ($0) and paid
  for (const addon of input.addons) {
    if (!addon.enabled) continue
    const label = moduleLabel(addon.module_key)
    const price = new Decimal(addon.unit_price)
    const description = price.gt(0)
      ? `Add-on contratado: ${label}`
      : `Módulo incluido en plan: ${label}`
    lines.push(makeLine('module_addon', description, 1, addon.unit_price, ivaRate))
  }

  // All enabled service extras — included ($0) and paid
  for (const extra of input.extras) {
    if (!extra.enabled) continue
    const label = billingExtraLabel(extra.extra_key)
    const price = new Decimal(extra.unit_price)
    const description = price.gt(0)
      ? `Servicio contratado: ${label}`
      : `Servicio incluido en plan: ${label}`
    lines.push(makeLine('extra_addon', description, 1, extra.unit_price, ivaRate))
  }

  // Metered usage — bill only quantity beyond plan allowance
  for (const u of input.usage) {
    const consumed = new Decimal(u.quantity)
    if (consumed.lte(0)) continue
    const unit = u.unit_label ?? 'unid.'
    const included = new Decimal(u.included_quantity || 0)
    const billableQty = Decimal.max(0, consumed.minus(included))

    if (included.gt(0)) {
      const planIncluded = new Decimal(u.plan_included_quantity ?? u.included_quantity)
      const subExtra = new Decimal(u.subscription_extra_included ?? 0)
      const includedDetail = subExtra.gt(0)
        ? `${trimQuantity(included.toString())} incluidos (${trimQuantity(planIncluded.toString())} plan + ${trimQuantity(subExtra.toString())} contrato)`
        : `${trimQuantity(included.toString())} incluidos en plan`
      lines.push(makeLine(
        'adjustment',
        `Consumo — ${u.label}: ${trimQuantity(u.quantity)} ${unit} · ${includedDetail}`,
        1,
        0,
        ivaRate,
      ))
    }

    if (billableQty.gt(0)) {
      const overageLabel = included.gt(0)
        ? `${trimQuantity(billableQty.toString())} ${unit} adicionales (${trimQuantity(u.quantity)} total)`
        : `${trimQuantity(u.quantity)} ${unit}`
      lines.push(makeLine(
        'usage',
        `Consumo medido — ${u.label}: ${overageLabel}`,
        billableQty.toString(),
        u.unit_price,
        ivaRate,
      ))
    } else if (included.gt(0)) {
      lines.push(makeLine(
        'usage',
        `Consumo medido — ${u.label}: ${trimQuantity(u.quantity)} ${unit} (incluidos en plan)`,
        u.quantity,
        0,
        ivaRate,
      ))
    }
  }

  return lines
}

function trimQuantity(qty: string): string {
  const d = new Decimal(qty)
  return d.mod(1).eq(0) ? d.toFixed(0) : d.toFixed(4).replace(/\.?0+$/, '')
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
