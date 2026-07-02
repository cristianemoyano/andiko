export const SHIPMENT_STATUSES = [
  'pending',
  'ready_to_ship',
  'dispatched',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'failed',
  'returned',
  'cancelled',
] as const
export type ShipmentStatus = typeof SHIPMENT_STATUSES[number]

export const FULFILLMENT_KINDS = ['in_house', 'andreani', 'correo_argentino', 'oca', 'manual'] as const
export type FulfillmentKind = typeof FULFILLMENT_KINDS[number]

export const SHIPMENT_EVENT_SOURCES = ['system', 'manual', 'webhook', 'poll'] as const
export type ShipmentEventSource = typeof SHIPMENT_EVENT_SOURCES[number]

export const TERMINAL_SHIPMENT_STATUSES: readonly ShipmentStatus[] = ['delivered', 'returned', 'cancelled']

/**
 * Máquina de estados del envío. `failed` es reintentable (nuevo intento de
 * entrega o devolución al remitente); `delivered`, `returned` y `cancelled`
 * son terminales.
 */
export const SHIPMENT_TRANSITIONS: Record<ShipmentStatus, readonly ShipmentStatus[]> = {
  pending:          ['ready_to_ship', 'dispatched', 'cancelled'],
  ready_to_ship:    ['dispatched', 'cancelled'],
  dispatched:       ['in_transit', 'out_for_delivery', 'delivered', 'failed', 'cancelled'],
  in_transit:       ['out_for_delivery', 'delivered', 'failed', 'returned'],
  out_for_delivery: ['delivered', 'failed'],
  failed:           ['out_for_delivery', 'in_transit', 'returned'],
  delivered:        [],
  returned:         [],
  cancelled:        [],
}

export function canTransitionShipment(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return SHIPMENT_TRANSITIONS[from].includes(to)
}

export function assertShipmentTransition(from: ShipmentStatus, to: ShipmentStatus): void {
  if (!canTransitionShipment(from, to)) {
    throw new Error('SHIPMENT_INVALID_TRANSITION')
  }
}
