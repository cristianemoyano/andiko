import { describe, it, expect } from 'vitest'
import {
  calcMargenBruto,
  calcMargenGananciaPct,
  calcRentabilidad,
  calcPuntoEquilibrio,
  calcCostCoveragePct,
} from './panel-metrics'

describe('panel-metrics', () => {
  it('calculates margen bruto on covered (costed) net sales minus CMV', () => {
    expect(calcMargenBruto(100000, 40000)).toBe(60000)
  })

  it('calculates margen de ganancia as profit over covered sales', () => {
    expect(calcMargenGananciaPct(100000, 40000)).toBe(60)
    expect(calcMargenGananciaPct(0, 0)).toBeNull()
    expect(calcMargenGananciaPct(-100, 0)).toBeNull()
  })

  it('does not treat missing-cost sales as free margin when using covered denominator', () => {
    // Full net sales 100k, but only 80k covered with CMV 40k → margin 50% on covered, not 60%
    expect(calcMargenGananciaPct(80000, 40000)).toBe(50)
    expect(calcMargenBruto(80000, 40000)).toBe(40000)
  })

  it('calculates rentabilidad in absolute and percent terms over covered sales', () => {
    expect(calcRentabilidad(100000, 40000, 20000)).toEqual({ value: 40000, pct: 40 })
    expect(calcRentabilidad(0, 0, 5000)).toEqual({ value: -5000, pct: null })
  })

  it('returns null break-even when margin is zero or negative', () => {
    expect(calcPuntoEquilibrio(50000, 0)).toBeNull()
    expect(calcPuntoEquilibrio(50000, -10)).toBeNull()
    expect(calcPuntoEquilibrio(50000, 25)).toBe(200000)
  })

  it('calculates cost coverage as share of net revenue with cost data', () => {
    expect(calcCostCoveragePct(80000, 100000)).toBe(80)
    expect(calcCostCoveragePct(0, 0)).toBe(100)
  })
})
