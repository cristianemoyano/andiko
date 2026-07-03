import { fetchJson } from '@/lib/fetch-json'

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
  allow_backorder: boolean
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
    if (!stock?.manage_stock || stock.allow_backorder) continue

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
    const stock = stockByVariant[variantId]
    if (stock?.allow_backorder) continue
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

export type LineItemCatalogRef = {
  product_id: string | null
  variant_id?: string | null
  description?: string
}

type ResolvedCatalogLine = {
  ref_id: string
  product_id: string
  variant_id: string
  name: string
}

/** True si alguna línea puede resolverse contra el catálogo (ids parciales o descripción). */
export function lineItemsNeedCatalogResolve(items: LineItemCatalogRef[]): boolean {
  return items.some((item) => {
    if (item.product_id && item.variant_id) return false
    return Boolean(item.product_id || item.variant_id || item.description?.trim())
  })
}

export function collectCatalogResolveIds(items: LineItemCatalogRef[]): string[] {
  const ids = new Set<string>()
  for (const item of items) {
    if (item.product_id && item.variant_id) continue
    if (item.product_id) ids.add(item.product_id)
    else if (item.variant_id) ids.add(item.variant_id)
  }
  return [...ids]
}

/** Completa product_id / variant_id en líneas legacy (POS, product_id=variant uuid, etc.). */
export async function resolveLineItemCatalogRefs<T extends LineItemCatalogRef>(
  items: T[],
  priceListId?: string | null,
): Promise<T[]> {
  const ids = collectCatalogResolveIds(items)
  let byRef = new Map<string, ResolvedCatalogLine>()

  if (ids.length > 0) {
    const params = new URLSearchParams({ resolve_ids: ids.join(',') })
    if (priceListId) params.set('price_list_id', priceListId)
    const res = await fetchJson<{ data: ResolvedCatalogLine[] }>(`/api/v1/catalog/products/for-sale?${params}`)
    byRef = new Map((res.data ?? []).map((row) => [row.ref_id, row]))
  }

  let next = items.map((item) => {
    if (item.product_id && item.variant_id) return item
    const ref = item.product_id ?? item.variant_id
    if (!ref) return item
    const resolved = byRef.get(ref)
    if (!resolved) return item
    return {
      ...item,
      product_id: resolved.product_id,
      variant_id: resolved.variant_id,
      description: item.description?.trim() ? item.description : resolved.name,
    }
  })

  const unresolved = next.filter((item) => !item.product_id || !item.variant_id)
  for (const item of unresolved) {
    const trimmed = item.description?.trim()
    if (!trimmed) continue
    const params = new URLSearchParams({ search: trimmed, limit: '10' })
    if (priceListId) params.set('price_list_id', priceListId)
    try {
      const res = await fetchJson<{ data: Array<{ product_id: string; variant_id: string; name: string }> }>(
        `/api/v1/catalog/products/for-sale?${params}`,
      )
      const exact = (res.data ?? []).filter((row) => row.name.toLowerCase() === trimmed.toLowerCase())
      if (exact.length !== 1) continue
      const match = exact[0]!
      next = next.map((row) => (row === item
        ? { ...row, product_id: match.product_id, variant_id: match.variant_id }
        : row))
    } catch {
      // mantener flujo manual
    }
  }

  return next
}
