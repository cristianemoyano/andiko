import { Decimal } from 'decimal.js'

// Balanza (electronic scale) barcode parsing for the ERP cloud.
//
// Argentine label-printing scales (Kretz, Systel, Gemini) print an EAN-13
// "variable measure" barcode: an in-store prefix (e.g. "20") + a PLU/item code
// + an embedded total PRICE (centavos) or WEIGHT (grams) + a check digit.
//
// NOTE: an equivalent, dependency-free implementation lives in
// `packages/shared/src/balanza.ts` for the POS app. Keep the two in sync.

export type BalanzaValueType = 'price' | 'weight'

export type BalanzaBarcodeConfig = {
  enabled: boolean
  prefix: string
  totalLength: number
  itemCodeStart: number
  itemCodeLength: number
  valueStart: number
  valueLength: number
  valueType: BalanzaValueType
  valueDivisor: number
  validateCheckDigit: boolean
}

export type ParsedBalanzaBarcode = {
  pluCode: string
  weightKg: string | null
  priceArs: string | null
}

/** Sensible Argentine default: Kretz/Systel price-embedded EAN-13, prefix "20". */
export const DEFAULT_BALANZA_CONFIG: BalanzaBarcodeConfig = {
  enabled: false,
  prefix: '20',
  totalLength: 13,
  itemCodeStart: 2,
  itemCodeLength: 5,
  valueStart: 7,
  valueLength: 5,
  valueType: 'price',
  valueDivisor: 100,
  validateCheckDigit: true,
}

export function isValidEan13CheckDigit(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false
  const digits = code.split('').map(Number)
  const check = digits.pop() as number
  const sum = digits.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0)
  const computed = (10 - (sum % 10)) % 10
  return computed === check
}

/**
 * Parse a scanned barcode against a balanza config. Returns null when the code
 * is not a (valid) scale barcode for this config — the caller should fall back
 * to a normal SKU/barcode lookup. Money/weight math uses Decimal.js (no floats).
 */
export function parseBalanzaBarcode(raw: string, cfg: BalanzaBarcodeConfig): ParsedBalanzaBarcode | null {
  const code = raw.trim()
  if (!cfg.enabled) return null
  if (!/^\d+$/.test(code)) return null
  if (code.length !== cfg.totalLength) return null
  if (cfg.prefix && !code.startsWith(cfg.prefix)) return null
  if (cfg.validateCheckDigit && code.length === 13 && !isValidEan13CheckDigit(code)) return null

  const pluCode = code.slice(cfg.itemCodeStart, cfg.itemCodeStart + cfg.itemCodeLength)
  const rawValue = code.slice(cfg.valueStart, cfg.valueStart + cfg.valueLength)
  if (pluCode.length !== cfg.itemCodeLength || rawValue.length !== cfg.valueLength) return null

  const value = new Decimal(rawValue).div(cfg.valueDivisor)
  if (cfg.valueType === 'weight') {
    return { pluCode, weightKg: value.toFixed(3), priceArs: null }
  }
  return { pluCode, weightKg: null, priceArs: value.toFixed(2) }
}
