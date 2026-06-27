import { UniqueConstraintError } from 'sequelize'

export function isAfipCbteUniqueViolation(err: unknown): boolean {
  if (!(err instanceof UniqueConstraintError)) return false
  const constraint = String((err.parent as { constraint?: string } | undefined)?.constraint ?? '')
  if (constraint.includes('uq_invoices_afip_cbte')) return true
  const fields = err.fields ?? {}
  return 'punto_venta' in fields && 'cbte_numero' in fields && 'comprobante_tipo' in fields
}
