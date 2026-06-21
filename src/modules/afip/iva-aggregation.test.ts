import { describe, it, expect } from 'vitest'
import { aggregateIva, inferIvaRate, headerLineItem } from './iva-aggregation'
import { ALIC_IVA } from './afip-codes'

describe('aggregateIva', () => {
  it('groups a single alícuota', () => {
    const r = aggregateIva([{ iva_rate: '21', tax_base: '100.00', tax_amount: '21.00' }])
    expect(r.iva).toEqual([{ Id: ALIC_IVA.RATE_21, BaseImp: '100.00', Importe: '21.00' }])
    expect(r.impNeto).toBe('100.00')
    expect(r.impIVA).toBe('21.00')
    expect(r.impTotal).toBe('121.00')
  })

  it('groups and sorts multiple alícuotas by AlicIva.Id', () => {
    const r = aggregateIva([
      { iva_rate: '21', tax_base: '100.00', tax_amount: '21.00' },
      { iva_rate: '10.5', tax_base: '200.00', tax_amount: '21.00' },
      { iva_rate: '21', tax_base: '50.00', tax_amount: '10.50' },
    ])
    expect(r.iva.map((a) => a.Id)).toEqual([ALIC_IVA.RATE_10_5, ALIC_IVA.RATE_21])
    expect(r.iva.find((a) => a.Id === ALIC_IVA.RATE_21)).toEqual({ Id: ALIC_IVA.RATE_21, BaseImp: '150.00', Importe: '31.50' })
    expect(r.impNeto).toBe('350.00')
    expect(r.impIVA).toBe('52.50')
    expect(r.impTotal).toBe('402.50')
  })

  it('handles a 0% rate with zero IVA', () => {
    const r = aggregateIva([{ iva_rate: '0', tax_base: '500.00', tax_amount: '0.00' }])
    expect(r.iva).toEqual([{ Id: ALIC_IVA.RATE_0, BaseImp: '500.00', Importe: '0.00' }])
    expect(r.impIVA).toBe('0.00')
    expect(r.impTotal).toBe('500.00')
  })

  it('returns zeros for an empty document', () => {
    const r = aggregateIva([])
    expect(r).toEqual({ impNeto: '0.00', impIVA: '0.00', impTotal: '0.00', iva: [] })
  })
})

describe('inferIvaRate', () => {
  it('infers standard rates from base + tax', () => {
    expect(inferIvaRate('100.00', '21.00')).toBe('21')
    expect(inferIvaRate('100.00', '10.50')).toBe('10.5')
    expect(inferIvaRate('100.00', '27.00')).toBe('27')
    expect(inferIvaRate('100.00', '0.00')).toBe('0')
  })

  it('returns 0 when base is zero', () => {
    expect(inferIvaRate('0.00', '0.00')).toBe('0')
  })

  it('snaps a near-21 effective rate to 21', () => {
    expect(inferIvaRate('100.00', '20.90')).toBe('21')
  })
})

describe('headerLineItem', () => {
  it('builds a single line from header totals net of discount', () => {
    expect(headerLineItem('1000.00', '100.00', '189.00')).toEqual({
      iva_rate: '21',
      tax_base: '900.00',
      tax_amount: '189.00',
    })
  })
})
