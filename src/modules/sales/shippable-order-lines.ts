import type { ProductType } from '@/modules/catalog/product.model'

export type ShipmentLineRef = {
  quantity: string
  shipped_qty?: string | null
  product_type?: ProductType | null
}

/** Líneas de mercadería; servicios y líneas sin catálogo no pasan por logística. */
export function isShippableLine(line: ShipmentLineRef): boolean {
  return line.product_type !== 'service'
}

export function linePendingShipmentQty(line: ShipmentLineRef): number {
  const qty = Number(line.quantity)
  const shipped = Number(line.shipped_qty ?? 0)
  if (!Number.isFinite(qty) || !Number.isFinite(shipped)) return 0
  return Math.max(0, qty - shipped)
}

export function orderHasPendingShipmentQty(items: ShipmentLineRef[]): boolean {
  return items
    .filter(isShippableLine)
    .some(line => linePendingShipmentQty(line) > 1e-9)
}
