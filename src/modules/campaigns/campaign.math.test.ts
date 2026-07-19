import { describe, it, expect } from 'vitest'
import { mergeDiscountPct } from './campaign.math'

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
