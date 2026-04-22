import Decimal from 'decimal.js'
import type { IvaRate } from '@/types'

export interface LineItemTotals {
  subtotal: string
  discount_amount: string
  tax_base: string
  tax_amount: string
  total: string
}

export function calcLineItem(
  quantity: string | number,
  unit_price: string | number,
  discount_pct: string | number,
  iva_rate: IvaRate,
): LineItemTotals {
  const qty     = new Decimal(quantity)
  const price   = new Decimal(unit_price)
  const discPct = new Decimal(discount_pct)
  const ivaRate = new Decimal(iva_rate).div(100)

  const subtotal        = qty.mul(price)
  const discount_amount = subtotal.mul(discPct).div(100)
  const tax_base        = subtotal.minus(discount_amount)
  const tax_amount      = tax_base.mul(ivaRate)
  const total           = tax_base.plus(tax_amount)

  return {
    subtotal:        subtotal.toFixed(2),
    discount_amount: discount_amount.toFixed(2),
    tax_base:        tax_base.toFixed(2),
    tax_amount:      tax_amount.toFixed(2),
    total:           total.toFixed(2),
  }
}

export interface DocumentTotals {
  subtotal: string
  discount_amount: string
  tax_amount: string
  total: string
}

export function calcDocumentTotals(items: LineItemTotals[]): DocumentTotals {
  const zero = new Decimal(0)
  const subtotal        = items.reduce((acc, i) => acc.plus(i.subtotal), zero)
  const discount_amount = items.reduce((acc, i) => acc.plus(i.discount_amount), zero)
  const tax_amount      = items.reduce((acc, i) => acc.plus(i.tax_amount), zero)
  const total           = items.reduce((acc, i) => acc.plus(i.total), zero)

  return {
    subtotal:        subtotal.toFixed(2),
    discount_amount: discount_amount.toFixed(2),
    tax_amount:      tax_amount.toFixed(2),
    total:           total.toFixed(2),
  }
}
