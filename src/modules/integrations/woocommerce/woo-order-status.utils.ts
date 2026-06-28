import type { OrderStatus } from '@/modules/sales/sales-order.model'

/** Woo statuses that mean the order should not hold ERP stock. */
export const CANCELLED_WOO_ORDER_STATUSES = new Set(['cancelled', 'refunded', 'failed', 'trash'])

export function isCancelledWooStatus(status: string): boolean {
  return CANCELLED_WOO_ORDER_STATUSES.has(status)
}

export const WOO_ORDER_STATUS_SLUGS = [
  'pending',
  'on-hold',
  'processing',
  'completed',
  'cancelled',
  'refunded',
  'failed',
  'trash',
] as const

export type WooOrderStatusSlug = (typeof WOO_ORDER_STATUS_SLUGS)[number]

export const WOO_ORDER_STATUS_LABELS: Record<WooOrderStatusSlug, string> = {
  pending: 'Pendiente de pago',
  processing: 'Procesando',
  'on-hold': 'En espera',
  completed: 'Completado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
  failed: 'Fallido',
  trash: 'Papelera',
}

export function wooOrderStatusLabel(status: string | null | undefined): string {
  if (!status) return '—'
  const known = WOO_ORDER_STATUS_LABELS[status as WooOrderStatusSlug]
  return known ?? status.replace(/-/g, ' ')
}

export function isWooOrderStatusSlug(status: string): status is WooOrderStatusSlug {
  return (WOO_ORDER_STATUS_SLUGS as readonly string[]).includes(status)
}

/** Maps WooCommerce order status slugs to the ERP operational status. */
export function mapWooStatusToErpStatus(wooStatus: string): OrderStatus {
  if (isCancelledWooStatus(wooStatus)) return 'cancelled'
  if (wooStatus === 'completed') return 'delivered'
  if (wooStatus === 'processing') return 'in_progress'
  return 'confirmed'
}

const ERP_PROGRESS_RANK: Partial<Record<OrderStatus, number>> = {
  draft: 0,
  confirmed: 1,
  in_progress: 2,
  delivered: 3,
  partial_returned: 4,
  returned: 5,
}

/**
 * Whether a Woo-driven ERP status should be applied on webhook re-ingest.
 * Never downgrades (e.g. delivered → confirmed); always allows cancellation.
 */
export function shouldApplyWooErpStatus(current: OrderStatus, target: OrderStatus): boolean {
  if (current === 'partial_returned' || current === 'returned') return false
  if (target === 'cancelled') return current !== 'cancelled'
  if (current === 'cancelled') return false
  const currentRank = ERP_PROGRESS_RANK[current] ?? 0
  const targetRank = ERP_PROGRESS_RANK[target] ?? 0
  return targetRank > currentRank
}
