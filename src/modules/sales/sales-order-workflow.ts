import type { OrderStatus } from './sales-order.model'
import {
  orderHasPendingShipmentQty,
  type ShipmentLineRef,
} from './shippable-order-lines'

export type { ShipmentLineRef } from './shippable-order-lines'
export { orderHasPendingShipmentQty, isShippableLine } from './shippable-order-lines'

/**
 * Pedido, factura, cobro, envío y entrega son pasos independientes.
 * No hay un pipeline obligatorio: cada empresa define el orden en su operación.
 */

/** Pedidos en los que se puede generar factura (sin exigir entrega, envío ni cobro previo). */
export const INVOICEABLE_ORDER_STATUSES: readonly OrderStatus[] = [
  'confirmed',
  'in_progress',
  'delivered',
]

export function isOrderInvoiceable(status: OrderStatus): boolean {
  return (INVOICEABLE_ORDER_STATUSES as readonly string[]).includes(status)
}

export type OrderStatusTransition = { next: OrderStatus; label: string }

/** Transiciones sugeridas en UI — no son obligatorias; el usuario puede saltar pasos. */
export const ORDER_STATUS_TRANSITIONS: Partial<Record<OrderStatus, OrderStatusTransition[]>> = {
  draft:       [{ next: 'confirmed',   label: 'Confirmar pedido' }],
  confirmed:   [
    { next: 'in_progress', label: 'En preparación' },
    { next: 'delivered',   label: 'Marcar entregado al cliente' },
  ],
  in_progress: [{ next: 'delivered', label: 'Marcar entregado al cliente' }],
}

export const ORDER_CANCELLABLE_STATUSES: readonly OrderStatus[] = [
  'draft',
  'confirmed',
  'in_progress',
]

/** Si el pedido admite crear un envío (solo líneas físicas con cantidad pendiente). */
export function orderAcceptsShipmentCreation(
  status: OrderStatus,
  items: ShipmentLineRef[],
): boolean {
  if (status === 'cancelled' || status === 'draft' || status === 'returned') return false
  if (!orderHasPendingShipmentQty(items)) return false
  if (status === 'confirmed' || status === 'in_progress' || status === 'partial_returned') return true
  if (status === 'delivered') return true
  return false
}
