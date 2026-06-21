import Decimal from 'decimal.js'
import { IVA_RATES, type IvaRate } from '@/types'
import { ALIC_IVA_BY_RATE, type AlicIvaId } from './afip-codes'

/** Minimal line-item shape needed to build the AFIP IVA breakdown. */
export type AfipLineItem = {
  iva_rate: IvaRate
  tax_base: string
  tax_amount: string
}

export type AfipIvaAlicuota = {
  Id: AlicIvaId
  BaseImp: string
  Importe: string
}

export type AfipIvaTotals = {
  /** Net taxed amount (sum of all bases) — AFIP ImpNeto. */
  impNeto: string
  /** Total IVA — AFIP ImpIVA. */
  impIVA: string
  /** Grand total — AFIP ImpTotal. */
  impTotal: string
  /** One entry per distinct alícuota present, ordered by AlicIva.Id. */
  iva: AfipIvaAlicuota[]
}

/**
 * Aggregates line items into the AFIP `Iva` array plus document totals.
 * Groups bases and IVA amounts by alícuota using Decimal.js (never float math).
 */
export function aggregateIva(items: AfipLineItem[]): AfipIvaTotals {
  const byRate = new Map<IvaRate, { base: Decimal; tax: Decimal }>()

  for (const item of items) {
    const entry = byRate.get(item.iva_rate) ?? { base: new Decimal(0), tax: new Decimal(0) }
    entry.base = entry.base.plus(item.tax_base)
    entry.tax = entry.tax.plus(item.tax_amount)
    byRate.set(item.iva_rate, entry)
  }

  const iva: AfipIvaAlicuota[] = [...byRate.entries()]
    .map(([rate, { base, tax }]) => ({
      Id: ALIC_IVA_BY_RATE[rate],
      BaseImp: base.toFixed(2),
      Importe: tax.toFixed(2),
    }))
    .sort((a, b) => a.Id - b.Id)

  const impNeto = iva.reduce((acc, a) => acc.plus(a.BaseImp), new Decimal(0))
  const impIVA = iva.reduce((acc, a) => acc.plus(a.Importe), new Decimal(0))

  return {
    impNeto: impNeto.toFixed(2),
    impIVA: impIVA.toFixed(2),
    impTotal: impNeto.plus(impIVA).toFixed(2),
    iva,
  }
}

/**
 * Infers the standard IVA rate from a base + tax amount. Used for credit/debit
 * notes, which store header totals only (no per-line iva_rate). Picks the closest
 * configured `IvaRate`; a zero base yields the 0% rate.
 */
export function inferIvaRate(taxBase: string, taxAmount: string): IvaRate {
  const base = new Decimal(taxBase)
  if (base.lte(0)) return '0'
  const effective = new Decimal(taxAmount).div(base).mul(100)
  let closest: IvaRate = '21'
  let bestDiff = new Decimal(Infinity)
  for (const rate of IVA_RATES) {
    const diff = effective.minus(rate).abs()
    if (diff.lt(bestDiff)) {
      bestDiff = diff
      closest = rate
    }
  }
  return closest
}

/**
 * Builds a single synthetic line item from a document's header totals, for
 * documents (notes) without stored per-line detail.
 */
export function headerLineItem(subtotal: string, discountAmount: string, taxAmount: string): AfipLineItem {
  const taxBase = new Decimal(subtotal).minus(discountAmount).toFixed(2)
  return {
    iva_rate: inferIvaRate(taxBase, taxAmount),
    tax_base: taxBase,
    tax_amount: new Decimal(taxAmount).toFixed(2),
  }
}
