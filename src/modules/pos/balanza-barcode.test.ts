import { describe, it, expect } from 'vitest'
import {
  parseBalanzaBarcode,
  isValidEan13CheckDigit,
  DEFAULT_BALANZA_CONFIG,
  type BalanzaBarcodeConfig,
} from './balanza-barcode'

// Helper: build a valid EAN-13 by appending the correct check digit to 12 digits.
function withCheckDigit(twelve: string): string {
  const digits = twelve.split('').map(Number)
  const sum = digits.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0)
  const check = (10 - (sum % 10)) % 10
  return `${twelve}${check}`
}

const priceCfg: BalanzaBarcodeConfig = { ...DEFAULT_BALANZA_CONFIG, enabled: true, valueType: 'price', valueDivisor: 100 }
const weightCfg: BalanzaBarcodeConfig = { ...DEFAULT_BALANZA_CONFIG, enabled: true, valueType: 'weight', valueDivisor: 1000 }

describe('isValidEan13CheckDigit', () => {
  it('accepts a valid EAN-13', () => {
    expect(isValidEan13CheckDigit(withCheckDigit('200003701500'))).toBe(true)
  })
  it('rejects a wrong check digit', () => {
    const valid = withCheckDigit('200003701500')
    const bad = valid.slice(0, 12) + ((Number(valid[12]) + 1) % 10)
    expect(isValidEan13CheckDigit(bad)).toBe(false)
  })
  it('rejects non-13-digit input', () => {
    expect(isValidEan13CheckDigit('123')).toBe(false)
  })
})

describe('parseBalanzaBarcode — price embedded', () => {
  it('parses PLU and price (centavos → ARS)', () => {
    // prefix 20, item 00037, value 01500 (=$15.00)
    const code = withCheckDigit('200003701500')
    expect(parseBalanzaBarcode(code, priceCfg)).toEqual({ pluCode: '00037', weightKg: null, priceArs: '15.00' })
  })

  it('trims surrounding whitespace from the scan', () => {
    const code = withCheckDigit('200003701500')
    expect(parseBalanzaBarcode(`  ${code}\n`, priceCfg)?.priceArs).toBe('15.00')
  })
})

describe('parseBalanzaBarcode — weight embedded', () => {
  it('parses PLU and weight (grams → kg)', () => {
    // value 00850 grams = 0.850 kg
    const code = withCheckDigit('200003700850')
    expect(parseBalanzaBarcode(code, weightCfg)).toEqual({ pluCode: '00037', weightKg: '0.850', priceArs: null })
  })
})

describe('parseBalanzaBarcode — rejections', () => {
  const valid = withCheckDigit('200003701500')

  it('returns null when disabled', () => {
    expect(parseBalanzaBarcode(valid, { ...priceCfg, enabled: false })).toBeNull()
  })
  it('returns null on wrong prefix', () => {
    expect(parseBalanzaBarcode(valid, { ...priceCfg, prefix: '29' })).toBeNull()
  })
  it('returns null on wrong length', () => {
    expect(parseBalanzaBarcode('2000037015', priceCfg)).toBeNull()
  })
  it('returns null on non-numeric input', () => {
    expect(parseBalanzaBarcode('20ABC3701500X', priceCfg)).toBeNull()
  })
  it('returns null on bad check digit when validation is on', () => {
    const bad = valid.slice(0, 12) + ((Number(valid[12]) + 1) % 10)
    expect(parseBalanzaBarcode(bad, priceCfg)).toBeNull()
  })
  it('parses despite bad check digit when validation is off', () => {
    const bad = valid.slice(0, 12) + ((Number(valid[12]) + 1) % 10)
    expect(parseBalanzaBarcode(bad, { ...priceCfg, validateCheckDigit: false })?.pluCode).toBe('00037')
  })
})
