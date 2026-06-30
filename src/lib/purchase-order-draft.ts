export const PURCHASE_ORDER_DRAFT_KEY = 'andiko:purchase-order-draft'

export type PurchaseOrderDraftItem = {
  product_id: string | null
  variant_id: string
  description: string
  quantity: string
}

export type PurchaseOrderDraft = {
  source: 'replenishment'
  items: PurchaseOrderDraftItem[]
  notes?: string
}

export function savePurchaseOrderDraft(draft: PurchaseOrderDraft): void {
  sessionStorage.setItem(PURCHASE_ORDER_DRAFT_KEY, JSON.stringify(draft))
}

export function consumePurchaseOrderDraft(): PurchaseOrderDraft | null {
  const raw = sessionStorage.getItem(PURCHASE_ORDER_DRAFT_KEY)
  if (!raw) return null
  sessionStorage.removeItem(PURCHASE_ORDER_DRAFT_KEY)
  try {
    const parsed = JSON.parse(raw) as PurchaseOrderDraft
    if (parsed?.source !== 'replenishment' || !Array.isArray(parsed.items)) return null
    return parsed
  } catch {
    return null
  }
}
