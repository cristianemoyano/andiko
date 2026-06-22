/** Normalize Sequelize DATEONLY (string) or Date to `yyyy-mm-dd`. */
export function formatDateOnly(value: Date | string | null | undefined): string | null {
  if (value == null) return null
  if (typeof value === 'string') return value.slice(0, 10)
  return value.toISOString().slice(0, 10)
}
