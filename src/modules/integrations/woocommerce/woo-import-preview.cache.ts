import 'server-only'

/** In-memory snapshot so paginated preview pages avoid re-fetching Woo on every click. */
export interface ImportPreviewSnapshot {
  woo_total: number
  matched: { sku: string; name: string }[]
  to_import: { sku: string; name: string }[]
  needs_mapping: { name: string; reason: string }[]
}

const TTL_MS = 15 * 60 * 1000
const store = new Map<string, { snapshot: ImportPreviewSnapshot; expiresAt: number }>()

export function importPreviewCacheKey(orgId: string, siteId: string): string {
  return `${orgId}:${siteId}`
}

export function getImportPreviewSnapshot(key: string): ImportPreviewSnapshot | null {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return null
  }
  return entry.snapshot
}

export function setImportPreviewSnapshot(key: string, snapshot: ImportPreviewSnapshot): void {
  store.set(key, { snapshot, expiresAt: Date.now() + TTL_MS })
}

export function invalidateImportPreviewSnapshot(key: string): void {
  store.delete(key)
}

export interface OrderImportPreviewItem {
  woo_order_id: number
  number: string
  status: string
  total: string | null
  date: string | null
  customer: string
}

export interface OrderImportPreviewSnapshot {
  fetched_total: number
  open_orders_only: boolean
  to_import: OrderImportPreviewItem[]
  already_imported: OrderImportPreviewItem[]
  skipped: OrderImportPreviewItem[]
}

const orderStore = new Map<string, { snapshot: OrderImportPreviewSnapshot; expiresAt: number }>()

export function orderImportPreviewCacheKey(
  orgId: string,
  siteId: string,
  openOrdersOnly: boolean,
  ordersSince: string | null,
): string {
  return `${orgId}:${siteId}:orders:${openOrdersOnly}:${ordersSince ?? 'all'}`
}

export function getOrderImportPreviewSnapshot(key: string): OrderImportPreviewSnapshot | null {
  const entry = orderStore.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    orderStore.delete(key)
    return null
  }
  return entry.snapshot
}

export function setOrderImportPreviewSnapshot(key: string, snapshot: OrderImportPreviewSnapshot): void {
  orderStore.set(key, { snapshot, expiresAt: Date.now() + TTL_MS })
}

export function invalidateOrderImportPreviewSnapshots(orgId: string, siteId: string): void {
  const prefix = `${orgId}:${siteId}:orders:`
  for (const key of orderStore.keys()) {
    if (key.startsWith(prefix)) orderStore.delete(key)
  }
}

export interface CustomerImportPreviewItem {
  woo_customer_id: number
  name: string
  email: string | null
}

export interface CustomerImportPreviewSnapshot {
  woo_total: number
  to_import: CustomerImportPreviewItem[]
  matched_by_email: CustomerImportPreviewItem[]
  already_linked: CustomerImportPreviewItem[]
  skipped: CustomerImportPreviewItem[]
}

const customerStore = new Map<string, { snapshot: CustomerImportPreviewSnapshot; expiresAt: number }>()

export function customerImportPreviewCacheKey(orgId: string, siteId: string): string {
  return `${orgId}:${siteId}:customers`
}

export function getCustomerImportPreviewSnapshot(key: string): CustomerImportPreviewSnapshot | null {
  const entry = customerStore.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    customerStore.delete(key)
    return null
  }
  return entry.snapshot
}

export function setCustomerImportPreviewSnapshot(key: string, snapshot: CustomerImportPreviewSnapshot): void {
  customerStore.set(key, { snapshot, expiresAt: Date.now() + TTL_MS })
}

export function invalidateCustomerImportPreviewSnapshot(key: string): void {
  customerStore.delete(key)
}
