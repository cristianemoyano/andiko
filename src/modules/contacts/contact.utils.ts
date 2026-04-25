// Validates Argentine CUIT/CUIL using the official checksum algorithm.
// Expected format: XX-XXXXXXXX-X (with or without dashes).
export function validateCuit(raw: string): boolean {
  const digits = raw.replace(/-/g, '')
  if (!/^\d{11}$/.test(digits)) return false

  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const sum = weights.reduce((acc, w, i) => acc + w * Number(digits[i]), 0)
  const remainder = sum % 11
  const checkDigit = remainder === 0 ? 0 : remainder === 1 ? 9 : 11 - remainder

  return checkDigit === Number(digits[10])
}

export function formatCuit(raw: string): string {
  const digits = raw.replace(/-/g, '')
  if (digits.length !== 11) return raw
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits[10]}`
}

/** Combined given name + family name for the contact person at the organization. */
export function formatContactPersonLabel(input: {
  first_name: string | null | undefined
  last_name: string | null | undefined
}): string | null {
  const first = input.first_name?.trim() ?? ''
  const last = input.last_name?.trim() ?? ''
  if (!first && !last) return null
  return [first, last].filter(Boolean).join(' ')
}

const CONTACT_TYPES = new Set(['customer', 'supplier', 'both'])

/** Lowercase, trim, collapse spaces, strip combining accents (Excel / Spanish labels). */
function importLabelKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Maps CSV / Excel "Tipo" values to API enums. Accepts English slugs and common Spanish labels.
 */
export function normalizeContactTypeForImport(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined
  const trimmed = raw.trim()
  if (trimmed === '') return undefined
  const lower = trimmed.toLowerCase()
  if (CONTACT_TYPES.has(lower)) return lower

  const key = importLabelKey(trimmed)
  const aliases: Record<string, 'customer' | 'supplier' | 'both'> = {
    cliente: 'customer',
    clientes: 'customer',
    proveedor: 'supplier',
    proveedores: 'supplier',
    ambos: 'both',
    'cliente y proveedor': 'both',
    'proveedor y cliente': 'both',
  }
  return aliases[key] ?? trimmed
}

/** Normalizes import row values that users often type in Spanish while keeping unknown fields unchanged. */
export function normalizeContactImportRow(row: Record<string, string>): Record<string, string> {
  const out = { ...row }
  if (out.type !== undefined && out.type.trim() !== '') {
    const n = normalizeContactTypeForImport(out.type)
    if (n !== undefined) out.type = n
  }
  return out
}
