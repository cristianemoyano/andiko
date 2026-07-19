import { describe, it, expect } from 'vitest'
import { analyzeMargin, summarizeMargins } from './campaign-margin.math'

describe('analyzeMargin — límite = costo variable', () => {
  it('descuento con margen positivo', () => {
    const r = analyzeMargin('1000', '600', '20')
    expect(r.discounted_price).toBe('800.00')
    expect(r.margin_amount).toBe('200.00')
    expect(r.margin_pct).toBe('25.00')
    expect(r.is_loss).toBe(false)
    // 1 − 600/1000 = 40%
    expect(r.max_safe_discount_pct).toBe('40.00')
  })

  it('marca pérdida cuando el precio con descuento cae por debajo del costo', () => {
    const r = analyzeMargin('1000', '600', '50') // precio 500 < costo 600
    expect(r.discounted_price).toBe('500.00')
    expect(r.margin_amount).toBe('-100.00')
    expect(r.is_loss).toBe(true)
  })

  it('el descuento en el límite exacto (precio = costo) es pérdida (debe ser mayor, no igual)', () => {
    const r = analyzeMargin('1000', '600', '40') // precio 600 = costo 600
    expect(r.discounted_price).toBe('600.00')
    expect(r.is_loss).toBe(true)
    expect(r.margin_amount).toBe('0.00')
  })

  it('costo 0: nunca pierde, descuento seguro hasta 100%', () => {
    const r = analyzeMargin('1000', '0', '90')
    expect(r.is_loss).toBe(false)
    expect(r.max_safe_discount_pct).toBe('100.00')
  })

  it('precio de lista 0: sin datos de rentabilidad', () => {
    const r = analyzeMargin('0', '0', '10')
    expect(r.max_safe_discount_pct).toBe('0.00')
    expect(r.margin_pct).toBe('0.00')
  })
})

describe('summarizeMargins', () => {
  it('cuenta pérdidas y calcula el techo seguro global (el más restrictivo)', () => {
    const rows = [
      analyzeMargin('1000', '600', '30'), // safe 40%, ok
      analyzeMargin('1000', '800', '30'), // safe 20%, precio 700 < costo 800 → pérdida
      analyzeMargin('1000', '500', '30'), // safe 50%, ok
    ]
    const s = summarizeMargins(rows)
    expect(s.products).toBe(3)
    expect(s.losing).toBe(1)
    expect(s.has_losses).toBe(true)
    // el techo global es el menor max_safe (20%)
    expect(s.safe_discount_ceiling_pct).toBe('20.00')
  })

  it('lista vacía', () => {
    const s = summarizeMargins([])
    expect(s.products).toBe(0)
    expect(s.has_losses).toBe(false)
  })
})
