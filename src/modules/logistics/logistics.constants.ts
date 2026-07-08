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

export const DELIVERY_RUN_STATUSES = ['draft', 'planned', 'dispatched', 'in_progress', 'completed', 'cancelled'] as const
export type DeliveryRunStatus = typeof DELIVERY_RUN_STATUSES[number]

export const DELIVERY_STOP_STATUSES = ['pending', 'arrived', 'delivered', 'partial', 'failed', 'returned', 'skipped'] as const
export type DeliveryStopStatus = typeof DELIVERY_STOP_STATUSES[number]

export const TERMINAL_SHIPMENT_STATUSES: readonly ShipmentStatus[] = ['delivered', 'returned', 'cancelled']

export function canEditShipment(status: ShipmentStatus): boolean {
  return !TERMINAL_SHIPMENT_STATUSES.includes(status)
}

export const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, string> = {
  pending:          'Pendiente',
  ready_to_ship:    'Listo para despachar',
  dispatched:       'Despachado',
  in_transit:       'En camino',
  out_for_delivery: 'En reparto',
  delivered:        'Entregado',
  failed:           'Entrega fallida',
  returned:         'Devuelto',
  cancelled:        'Cancelado',
}

export const FULFILLMENT_KIND_LABEL: Record<FulfillmentKind, string> = {
  in_house:         'Reparto propio',
  andreani:         'Andreani',
  correo_argentino: 'Correo Argentino',
  oca:              'OCA',
  manual:           'Otro courier',
}

export const DELIVERY_RUN_STATUS_LABEL: Record<DeliveryRunStatus, string> = {
  draft:       'Borrador',
  planned:     'Planificada',
  dispatched:  'Despachada',
  in_progress: 'En reparto',
  completed:   'Completada',
  cancelled:   'Cancelada',
}

export const DELIVERY_STOP_STATUS_LABEL: Record<DeliveryStopStatus, string> = {
  pending:   'Pendiente',
  arrived:   'En parada',
  delivered: 'Entregada',
  partial:   'Parcial',
  failed:    'Fallida',
  returned:  'Devuelta',
  skipped:   'Saltada',
}

/**
 * Máquina de estados del envío. `failed` es reintentable (nuevo intento de
 * entrega o devolución al remitente); `delivered`, `returned` y `cancelled`
 * son terminales.
 */
export const SHIPMENT_TRANSITIONS: Record<ShipmentStatus, readonly ShipmentStatus[]> = {
  pending:          ['ready_to_ship', 'dispatched', 'cancelled'],
  ready_to_ship:    ['dispatched', 'cancelled'],
  dispatched:       ['in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned', 'cancelled'],
  in_transit:       ['out_for_delivery', 'delivered', 'failed', 'returned'],
  out_for_delivery: ['delivered', 'failed', 'returned'],
  failed:           ['out_for_delivery', 'in_transit', 'returned'],
  delivered:        [],
  returned:         [],
  cancelled:        [],
}

export const TERMINAL_DELIVERY_RUN_STATUSES: readonly DeliveryRunStatus[] = ['completed', 'cancelled']

export const DELIVERY_RUN_TRANSITIONS: Record<DeliveryRunStatus, readonly DeliveryRunStatus[]> = {
  draft:       ['planned', 'cancelled'],
  planned:     ['dispatched', 'cancelled'],
  dispatched:  ['in_progress'],
  in_progress: ['completed'],
  completed:   [],
  cancelled:   [],
}

export function canTransitionShipment(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return SHIPMENT_TRANSITIONS[from].includes(to)
}

export function assertShipmentTransition(from: ShipmentStatus, to: ShipmentStatus): void {
  if (!canTransitionShipment(from, to)) {
    throw new Error('SHIPMENT_INVALID_TRANSITION')
  }
}

export function canTransitionDeliveryRun(from: DeliveryRunStatus, to: DeliveryRunStatus): boolean {
  return DELIVERY_RUN_TRANSITIONS[from].includes(to)
}

export function assertDeliveryRunTransition(from: DeliveryRunStatus, to: DeliveryRunStatus): void {
  if (!canTransitionDeliveryRun(from, to)) {
    throw new Error('DELIVERY_RUN_INVALID_TRANSITION')
  }
}

/** Código de seguimiento para reparto propio: el número de envío (ENV-XX-NNNN). */
export function resolveInHouseTrackingNumber(
  shipmentNumber: string,
  explicit?: string | null,
): string {
  const trimmed = explicit?.trim()
  return trimmed || shipmentNumber
}
