const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

/**
 * Human-readable file size, e.g. `formatBytes(1536)` → "1.5 KB".
 * Uses 1024-based units; trims trailing `.0`. Accepts numbers or numeric strings
 * (file `byte_size` comes back from Postgres BIGINT as a string).
 */
export function formatBytes(bytes: number | string | null | undefined): string {
  const n = typeof bytes === 'string' ? Number(bytes) : bytes
  if (n == null || !Number.isFinite(n) || n < 0) return '—'
  if (n < 1) return '0 B'

  const exp = Math.min(Math.floor(Math.log(n) / Math.log(1024)), UNITS.length - 1)
  const value = n / 1024 ** exp
  const rounded = exp === 0 ? value : Math.round(value * 10) / 10
  return `${rounded} ${UNITS[exp]}`
}
