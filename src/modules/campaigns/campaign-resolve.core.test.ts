import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { resolveCampaigns } from './campaign-resolve.core'
import type { CartLine, CartContext, CampaignRule } from './campaign-resolver.types'

const SAT = new Date(2026, 6, 18, 14, 0)

function line(over: Partial<CartLine> = {}): CartLine {
  return {
    line_id: 'l1', product_id: 'p1', variant_id: 'v1', category_id: 'c1',
    quantity: '1', unit_price: '1000', discount_pct: '0', iva_rate: '21', ...over,
  }
}

function cart(over: Partial<CartContext> = {}): CartContext {
  return {
    branch_id: null, contact_id: null, channel: 'pos',
    payment_method: null, payment_condition: null, wallet: null,
    card_brand: null, card_type: null, via_qr: null, coupon_codes: [],
    at: SAT, ...over,
  }
}

function rule(over: Partial<CampaignRule> = {}): CampaignRule {
  return {
    id: 'camp1', name: 'Campaña', branch_id: null,
    reward_kind: 'percent', reward_percent: '15',
    installments_count: null, installments_interest_free: null,
    requires_coupon: false, stackable: false, priority: 100,
    min_purchase_amount: null,
    valid_from: new Date(2025, 0, 1), valid_to: new Date(2027, 0, 1),
    active_weekdays: null, active_time_from: null, active_time_to: null,
    channels: null, targets: [], paymentRules: [], couponId: null, ...over,
  }
}

describe('resolveCampaigns', () => {
  it('aplica un porcentaje a la línea que califica y baja el total', () => {
    const res = resolveCampaigns([rule({ reward_percent: '15' })], [line()], cart(), 'max')
    expect(res.adjustedLines[0].discount_pct).toBe('15.00')
    expect(res.effects).toHaveLength(1)
    expect(res.effects[0].effect_kind).toBe('line_discount_pct')
    expect(new Decimal(res.totalsAfter.total).lt(res.totalsBefore.total)).toBe(true)
    expect(res.applications[0].applied_discount_amount).toBe('150.00')
  })

  it('cuotas sin interés: beneficio no monetario, sin cambiar líneas ni totales', () => {
    const res = resolveCampaigns(
      [rule({ reward_kind: 'installments', reward_percent: null, installments_count: 3, installments_interest_free: true })],
      [line()], cart(), 'max',
    )
    expect(res.effects).toHaveLength(0)
    expect(res.benefits).toHaveLength(1)
    expect(res.benefits[0].installments_count).toBe(3)
    expect(res.adjustedLines[0].discount_pct).toBe('0')
    expect(res.totalsAfter.total).toBe(res.totalsBefore.total)
    expect(res.applications[0].benefit_snapshot).toContain('3 cuotas sin interés')
  })

  it('emite DOUBLE_DISCOUNT_ON_LINE cuando ya había descuento manual', () => {
    const res = resolveCampaigns([rule({ reward_percent: '15' })], [line({ discount_pct: '10' })], cart(), 'max')
    expect(res.warnings).toContain('DOUBLE_DISCOUNT_ON_LINE')
    expect(res.adjustedLines[0].discount_pct).toBe('15.00') // max(10, 15)
  })

  it('campañas no acumulables: solo la de mayor prioridad toca la línea', () => {
    const res = resolveCampaigns(
      [rule({ id: 'a', reward_percent: '20', priority: 10 }), rule({ id: 'b', reward_percent: '30', priority: 20 })],
      [line()], cart(), 'max',
    )
    expect(res.adjustedLines[0].discount_pct).toBe('20.00')
    expect(res.effects).toHaveLength(1)
    expect(res.effects[0].campaign_id).toBe('a')
  })

  it('respeta targets: solo descuenta las líneas incluidas', () => {
    const lines = [line({ line_id: 'a', category_id: 'c1' }), line({ line_id: 'b', category_id: 'c2' })]
    const res = resolveCampaigns(
      [rule({ targets: [{ target_kind: 'category', category_id: 'c1', product_id: null, variant_id: null, is_exclusion: false }] })],
      lines, cart(), 'max',
    )
    expect(res.adjustedLines.find((l) => l.line_id === 'a')!.discount_pct).toBe('15.00')
    expect(res.adjustedLines.find((l) => l.line_id === 'b')!.discount_pct).toBe('0')
  })
})
