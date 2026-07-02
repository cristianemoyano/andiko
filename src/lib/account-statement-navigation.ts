export type AccountStatementModule = 'sales' | 'purchases'

export interface AccountMovementLinkInput {
  movement_type: string
  movement_id: string
  related_id?: string | null
}

/** Resolves the ERP detail page for an account-statement movement row. */
export function getAccountMovementHref(
  module: AccountStatementModule,
  movement: AccountMovementLinkInput,
): string | null {
  if (module === 'sales') {
    switch (movement.movement_type) {
      case 'invoice':
        return `/ventas/facturas/${movement.movement_id}`
      case 'credit_note':
        return `/ventas/notas-de-credito/${movement.movement_id}`
      case 'payment':
        return movement.related_id ? `/ventas/facturas/${movement.related_id}` : null
      case 'refund':
        return movement.related_id ? `/ventas/devoluciones/${movement.related_id}` : null
      default:
        return null
    }
  }

  switch (movement.movement_type) {
    case 'invoice':
      return `/compras/facturas/${movement.movement_id}`
    case 'payment':
      return movement.related_id ? `/compras/facturas/${movement.related_id}` : null
    default:
      return null
  }
}
