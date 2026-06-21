// Balanza (electronic scale) barcode parsing — shared between ERP cloud and POS.
//
// Argentine label-printing scales (Kretz, Systel, Gemini) print an EAN-13
// "variable measure" barcode: an in-store prefix (e.g. "20") + a PLU/item code
// + an embedded total PRICE (centavos) or WEIGHT (grams) + a check digit.
//
// This module has NO runtime dependencies so it can live in @andiko/shared.
// Money/weight scaling uses BigInt (exact integer math — never floats).

export type BalanzaValueType = 'price' | 'weight'

export type BalanzaBarcodeConfig = {
  /** When false the parser always returns null (feature off). */
  enabled: boolean
  /** Leading digits that identify a scale barcode, e.g. "2" or "20". */
  prefix: string
  /** Total digit count of the barcode (13 for EAN-13). */
  totalLength: number
  /** 0-based offset where the PLU/item code starts. */
  itemCodeStart: number
  itemCodeLength: number
  /** 0-based offset where the embedded value starts. */
  valueStart: number
  valueLength: number
  /** Whether the embedded value is a total price or a weight. */
  valueType: BalanzaValueType
  /** Divisor applied to the embedded integer (price→100 centavos, weight→1000 g). */
  valueDivisor: number
  /** Validate the EAN-13 mod-10 check digit (only when totalLength === 13). */
  validateCheckDigit: boolean
}

export type ParsedBalanzaBarcode = {
  pluCode: string
  /** kg as a fixed-3-decimal string, when valueType === 'weight'. */
  weightKg: string | null
  /** ARS as a fixed-2-decimal string, when valueType === 'price'. */
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
 * Divide an integer-valued numeric string by `divisor` and render it with
 * `decimals` fractional digits, rounding half-up. Exact (BigInt, no floats).
 */
export function scaleIntegerString(intStr: string, divisor: number, decimals: number): string {
  const n = BigInt(intStr)
  const d = BigInt(divisor)
  const scale = BigInt(10) ** BigInt(decimals)
  // round(n / d, decimals) == (n * scale + d/2) / d  (integer division)
  const scaled = (n * scale + d / BigInt(2)) / d
  const s = scaled.toString().padStart(decimals + 1, '0')
  if (decimals === 0) return s
  const intPart = s.slice(0, s.length - decimals)
  const fracPart = s.slice(s.length - decimals)
  return `${intPart}.${fracPart}`
}

/**
 * Parse a scanned barcode against a balanza config. Returns null when the code
 * is not a (valid) scale barcode for this config — the caller should then fall
 * back to a normal SKU/barcode lookup.
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

  if (cfg.valueType === 'weight') {
    return { pluCode, weightKg: scaleIntegerString(rawValue, cfg.valueDivisor, 3), priceArs: null }
  }
  return { pluCode, weightKg: null, priceArs: scaleIntegerString(rawValue, cfg.valueDivisor, 2) }
}
