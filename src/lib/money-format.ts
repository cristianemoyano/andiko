function decToString(v: unknown): string {
  if (v == null) return '0.00'
  return String(v)
}

/** Formats a numeric/decimal-ish value as ARS currency (es-AR locale). */
export function formatArs(v: unknown): string {
  const n = Number(decToString(v))
  if (Number.isNaN(n)) return decToString(v)
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}
