import {
  isShippableLine,
  type ShipmentLineRef,
} from './shippable-order-lines'

export type OrderShipmentProgress = {
  totalQty: number
  shippedQty: number
  pendingQty: number
  hasShippableLines: boolean
  isPartiallyShipped: boolean
  isFullyShipped: boolean
}

export function formatShipmentQty(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return value.toFixed(4).replace(/\.?0+$/, '')
}

export function computeOrderShipmentProgress(items: ShipmentLineRef[]): OrderShipmentProgress {
  const shippable = items.filter(isShippableLine)

  let totalQty = 0
  let shippedQty = 0
  for (const line of shippable) {
    const qty = Number(line.quantity)
    const shipped = Number(line.shipped_qty ?? 0)
    if (!Number.isFinite(qty) || qty <= 0) continue
    totalQty += qty
    shippedQty += Number.isFinite(shipped) ? Math.max(0, shipped) : 0
  }

  const pendingQty = Math.max(0, totalQty - shippedQty)
  const hasShippableLines = shippable.some(line => (Number(line.quantity) || 0) > 0)

  return {
    totalQty,
    shippedQty,
    pendingQty,
    hasShippableLines,
    isPartiallyShipped: hasShippableLines && shippedQty > 1e-9 && pendingQty > 1e-9,
    isFullyShipped: hasShippableLines && pendingQty <= 1e-9 && shippedQty > 1e-9,
  }
}

export function orderLineRefsFromItems(
  items: Array<{
    quantity: string
    shipped_qty?: string | null
    product_type?: ShipmentLineRef['product_type']
  }>,
): ShipmentLineRef[] {
  return items.map(item => ({
    quantity: item.quantity,
    shipped_qty: item.shipped_qty,
    product_type: item.product_type ?? null,
  }))
}
