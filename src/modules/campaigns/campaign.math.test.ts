import { describe, it, expect } from 'vitest'
import { mergeDiscountPct, fixedAmountToPct, bogoPct } from './campaign.math'

describe('mergeDiscountPct', () => {
  it('max: toma el mayor entre manual y campaña', () => {
    expect(mergeDiscountPct('10', '15', 'max')).toEqual({ pct: '15.00', doubled: true })
    expect(mergeDiscountPct('20', '15', 'max')).toEqual({ pct: '20.00', doubled: true })
  })

  it('max: sin descuento manual no marca doble descuento', () => {
    expect(mergeDiscountPct('0', '15', 'max')).toEqual({ pct: '15.00', doubled: false })
  })

  it('add_capped: suma y topa a 100', () => {
    expect(mergeDiscountPct('10', '15', 'add_capped')).toEqual({ pct: '25.00', doubled: true })
    expect(mergeDiscountPct('80', '40', 'add_capped')).toEqual({ pct: '100.00', doubled: true })
  })

  it('replace: usa el de campaña pero nunca por debajo del manual pactado', () => {
    expect(mergeDiscountPct('10', '15', 'replace')).toEqual({ pct: '15.00', doubled: true })
    // replace con campaña menor al manual: no baja del manual
    expect(mergeDiscountPct('20', '15', 'replace')).toEqual({ pct: '20.00', doubled: true })
  })

  it('mantiene el resultado dentro de [0, 100] y con 2 decimales', () => {
    expect(mergeDiscountPct('0', '0', 'max')).toEqual({ pct: '0.00', doubled: false })
    expect(mergeDiscountPct('12.5', '0', 'max')).toEqual({ pct: '12.50', doubled: false })
  })
})

describe('fixedAmountToPct — monto fijo prorrateado', () => {
  it('monto sobre base da un % uniforme', () => {
    // $200 sobre base $1000 = 20%
    expect(fixedAmountToPct('200', '1000')).toBe('20.00')
  })
  it('topa a 100% si el monto supera la base', () => {
    expect(fixedAmountToPct('1500', '1000')).toBe('100.00')
  })
  it('base 0 → 0%', () => {
    expect(fixedAmountToPct('200', '0')).toBe('0.00')
  })
})

describe('bogoPct — 2x1 / lleva X paga Y', () => {
  it('2x1 con cantidad par: 50%', () => {
    // buy 1 get 1 → grupo 2; qty 4 → 2 gratis → 50%
    expect(bogoPct('4', '1', '1')).toBe('50.00')
  })
  it('2x1 con cantidad impar: solo grupos completos', () => {
    // qty 3 → floor(3/2)=1 grupo → 1 gratis → 33.33%
    expect(bogoPct('3', '1', '1')).toBe('33.33')
  })
  it('sin grupo completo: 0%', () => {
    expect(bogoPct('1', '1', '1')).toBe('0.00')
  })
  it('3x2 (lleva 3 paga 2): 1 gratis cada 3', () => {
    // buy 2 get 1 → grupo 3; qty 6 → 2 gratis → 33.33%
    expect(bogoPct('6', '2', '1')).toBe('33.33')
  })
})
