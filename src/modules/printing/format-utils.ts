export function formatDateArg(value: Date | string | null | undefined): string | null {
  if (value == null) return null
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function decString(v: unknown): string {
  if (v == null) return '0'
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return String(v)
}
