import { describe, it, expect } from 'vitest'
import { evaluateCampaign, qualifyingLineIds, paymentRuleMatches, cartGrossSubtotal, weekdayInTz } from './campaign-match'
import type { CartLine, CartContext, CampaignRule } from './campaign-resolver.types'

function line(over: Partial<CartLine> = {}): CartLine {
  return {
    line_id: 'l1',
    product_id: 'p1',
    variant_id: 'v1',
    category_id: 'c1',
    brand: 'Chandon',
    quantity: '1',
    unit_price: '100000',
    discount_pct: '0',
    iva_rate: '21',
    ...over,
  }
}

function cart(over: Partial<CartContext> = {}): CartContext {
  return {
    branch_id: null,
    contact_id: null,
    channel: 'pos',
    payment_method: null,
    payment_condition: null,
    wallet: null,
    card_brand: null,
    card_type: null,
    via_qr: null,
    coupon_codes: [],
    at: new Date(2026, 6, 15, 14, 0), // 15-jul-2026 (día local), 14:00
    ...over,
  }
}

const FAR_FUTURE = new Date(2027, 0, 1)
const PAST = new Date(2025, 0, 1)

function baseRule(over: Partial<CampaignRule> = {}): CampaignRule {
  return {
    id: 'camp1',
    name: 'Campaña',
    branch_id: null,
    reward_kind: 'percent',
    reward_percent: '15',
    installments_count: null,
    installments_interest_free: null,
    requires_coupon: false,
    stackable: false,
    priority: 100,
    min_purchase_amount: null,
    valid_from: PAST,
    valid_to: FAR_FUTURE,
    active_weekdays: null,
    active_time_from: null,
    active_time_to: null,
    channels: null,
    targets: [],
    paymentRules: [],
    ...over,
  }
}

describe('paymentRuleMatches', () => {
  it('los campos nulos de la regla son comodín; los seteados deben coincidir', () => {
    const c = cart({ wallet: 'mercadopago', card_type: 'credit', via_qr: true })
    expect(paymentRuleMatches({ wallet: 'mercadopago', card_type: 'credit', via_qr: true, payment_method: null, payment_condition: null, card_brand: null }, c)).toBe(true)
    expect(paymentRuleMatches({ wallet: 'modo', card_type: null, via_qr: null, payment_method: null, payment_condition: null, card_brand: null }, c)).toBe(false)
    expect(paymentRuleMatches({ card_type: 'debit', wallet: null, via_qr: null, payment_method: null, payment_condition: null, card_brand: null }, c)).toBe(false)
  })
})

describe('qualifyingLineIds', () => {
  it('sin targets aplica a todas las líneas', () => {
    const lines = [line({ line_id: 'a' }), line({ line_id: 'b', category_id: 'c2' })]
    expect(qualifyingLineIds(baseRule(), lines)).toEqual(['a', 'b'])
  })

  it('inclusión por categoría + exclusión por producto', () => {
    const lines = [
      line({ line_id: 'a', category_id: 'c1', product_id: 'p1' }),
      line({ line_id: 'b', category_id: 'c1', product_id: 'pEXCL' }),
      line({ line_id: 'c', category_id: 'cX', product_id: 'p3' }),
    ]
    const rule = baseRule({
      targets: [
        { target_kind: 'category', category_id: 'c1', product_id: null, variant_id: null, brand: null, is_exclusion: false },
        { target_kind: 'product', category_id: null, product_id: 'pEXCL', variant_id: null, brand: null, is_exclusion: true },
      ],
    })
    expect(qualifyingLineIds(rule, lines)).toEqual(['a'])
  })
})

describe('evaluateCampaign — ejemplo real A (3 cuotas MP crédito QR ≥ $150k, mié/jue, no online)', () => {
  const wed = new Date(2026, 6, 15, 14, 0)
  const sat = new Date(2026, 6, 18, 14, 0)
  const rule = baseRule({
    reward_kind: 'installments',
    reward_percent: null,
    installments_count: 3,
    installments_interest_free: true,
    channels: ['pos', 'manual'], // excluye online
    active_weekdays: [weekdayInTz(wed), (weekdayInTz(wed) + 1) % 7], // mié y jue (en TZ Argentina)
    min_purchase_amount: '150000',
    paymentRules: [{ wallet: 'mercadopago', card_type: 'credit', via_qr: true, payment_method: null, payment_condition: null, card_brand: null }],
  })
  const mpQr = { wallet: 'mercadopago' as const, card_type: 'credit' as const, via_qr: true }

  it('aplica cuando matchea todo', () => {
    const res = evaluateCampaign(rule, [line({ unit_price: '200000' })], cart({ at: wed, channel: 'pos', ...mpQr }))
    expect(res.applies).toBe(true)
  })

  it('no aplica online', () => {
    const res = evaluateCampaign(rule, [line({ unit_price: '200000' })], cart({ at: wed, channel: 'online', ...mpQr }))
    expect(res.applies).toBe(false)
  })

  it('no aplica por debajo del mínimo', () => {
    const res = evaluateCampaign(rule, [line({ unit_price: '100000' })], cart({ at: wed, channel: 'pos', ...mpQr }))
    expect(res.applies).toBe(false)
  })

  it('no aplica el sábado', () => {
    const res = evaluateCampaign(rule, [line({ unit_price: '200000' })], cart({ at: sat, channel: 'pos', ...mpQr }))
    expect(res.applies).toBe(false)
  })

  it('no aplica con débito', () => {
    const res = evaluateCampaign(rule, [line({ unit_price: '200000' })], cart({ at: wed, channel: 'pos', wallet: 'mercadopago', card_type: 'debit', via_qr: true }))
    expect(res.applies).toBe(false)
  })
})

describe('evaluateCampaign — ejemplo real B (15% sábados, no online, cualquier medio)', () => {
  const sat = new Date(2026, 6, 18, 14, 0)
  const rule = baseRule({
    reward_percent: '15',
    channels: ['pos', 'manual'],
    active_weekdays: [weekdayInTz(sat)],
  })

  it('aplica el sábado en cualquier medio', () => {
    expect(evaluateCampaign(rule, [line()], cart({ at: sat, channel: 'manual', payment_method: 'cash' })).applies).toBe(true)
  })

  it('no aplica online', () => {
    expect(evaluateCampaign(rule, [line()], cart({ at: sat, channel: 'online' })).applies).toBe(false)
  })

  it('no aplica fuera de vigencia', () => {
    const expired = baseRule({ valid_to: PAST, valid_from: new Date(2024, 0, 1) })
    expect(evaluateCampaign(expired, [line()], cart({ at: sat })).applies).toBe(false)
  })
})

describe('qualifyingLineIds — targeting por marca (product.vendor)', () => {
  const lines = [
    line({ line_id: 'a', brand: 'Chandon' }),
    line({ line_id: 'b', brand: 'Mumm' }),
    line({ line_id: 'c', brand: 'Baron B' }),
  ]

  it('incluye solo las líneas de las marcas indicadas (normaliza mayúsculas/espacios)', () => {
    const rule = baseRule({
      targets: [{ target_kind: 'brand', category_id: null, product_id: null, variant_id: null, brand: '  chandon ', is_exclusion: false }],
    })
    expect(qualifyingLineIds(rule, lines)).toEqual(['a'])
  })

  it('marca excluida: aplica a todo salvo esa marca', () => {
    const rule = baseRule({
      targets: [{ target_kind: 'brand', category_id: null, product_id: null, variant_id: null, brand: 'Mumm', is_exclusion: true }],
    })
    expect(qualifyingLineIds(rule, lines)).toEqual(['a', 'c'])
  })

  it('categoría incluida + marca excluida (espumantes salvo Baron B)', () => {
    const catLines = [
      line({ line_id: 'a', category_id: 'espumantes', brand: 'Chandon' }),
      line({ line_id: 'b', category_id: 'espumantes', brand: 'Baron B' }),
      line({ line_id: 'c', category_id: 'vinos', brand: 'Chandon' }),
    ]
    const rule = baseRule({
      targets: [
        { target_kind: 'category', category_id: 'espumantes', product_id: null, variant_id: null, brand: null, is_exclusion: false },
        { target_kind: 'brand', category_id: null, product_id: null, variant_id: null, brand: 'Baron B', is_exclusion: true },
      ],
    })
    expect(qualifyingLineIds(rule, catLines)).toEqual(['a'])
  })
})

describe('cartGrossSubtotal', () => {
  it('suma cantidad × precio de todas las líneas', () => {
    expect(cartGrossSubtotal([line({ quantity: '2', unit_price: '100' }), line({ quantity: '1', unit_price: '50' })])).toBe('250.00')
  })
})
