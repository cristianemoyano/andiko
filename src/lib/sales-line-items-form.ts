/** Índice de la primera línea sin producto/variante del catálogo, o -1 si todas están completas. */
export function findLineWithoutCatalogProduct(
  items: Array<{ product_id: string | null; variant_id?: string | null }>,
): number {
  return items.findIndex((item) => !item.product_id || !item.variant_id)
}

export function catalogProductRequiredMessage(lineIndex: number): string {
  return `Seleccioná un producto del catálogo en la línea ${lineIndex + 1} antes de guardar.`
}

export type BranchStockInfo = {
  quantity: number
  manage_stock: boolean
}

export type BranchStockMap = Record<string, BranchStockInfo>

/** Primera línea cuya demanda acumulada supera el stock de sucursal, o -1. */
export function findLineExceedingBranchStock(
  items: Array<{ variant_id: string | null; quantity: string }>,
  stockByVariant: BranchStockMap,
): number {
  const demandByVariant = new Map<string, { total: number; firstLine: number }>()

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!
    if (!item.variant_id) continue
    const stock = stockByVariant[item.variant_id]
    if (!stock?.manage_stock) continue

    const qty = parseFloat(item.quantity) || 0
    if (qty <= 0) continue

    const prev = demandByVariant.get(item.variant_id)
    if (prev) {
      prev.total += qty
    } else {
      demandByVariant.set(item.variant_id, { total: qty, firstLine: i })
    }
  }

  for (const [variantId, demand] of demandByVariant) {
    const available = stockByVariant[variantId]?.quantity ?? 0
    if (demand.total > available) return demand.firstLine
  }

  return -1
}

export function insufficientBranchStockMessage(lineIndex: number): string {
  return `Stock insuficiente en la línea ${lineIndex + 1}. Transferí mercadería al depósito de la sucursal antes de vender.`
}

export function formatBranchStockLabel(quantity: number): string {
  if (Number.isInteger(quantity)) return String(quantity)
  return quantity.toFixed(4).replace(/\.?0+$/, '')
}
