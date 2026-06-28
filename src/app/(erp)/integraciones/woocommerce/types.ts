export interface WooSiteRow {
  id: string
  branch_id: string
  name: string
  store_url: string
  price_list_id: string | null
  auto_publish: boolean
  stock_safety_buffer: string
  is_active: boolean
  has_webhook_secret: boolean
  last_order_synced_at: string | null
  last_stock_pushed_at: string | null
}

export interface OptionRow {
  id: string
  name: string
}

export type ImportPreviewSection = 'matched' | 'to_import' | 'needs_mapping'

export interface ImportPreviewMatchedItem {
  sku: string
  name: string
}

export interface ImportPreviewMappingItem {
  name: string
  reason: string
}

export interface ImportPreview {
  woo_total: number
  matched_count: number
  to_import_count: number
  needs_mapping_count: number
  section: ImportPreviewSection
  items: ImportPreviewMatchedItem[] | ImportPreviewMappingItem[]
  page: number
  limit: number
  total: number
  pages: number
}

export type OrderImportPreviewSection = 'to_import' | 'already_imported' | 'skipped'

export interface OrderImportPreviewItem {
  woo_order_id: number
  number: string
  status: string
  total: string | null
  date: string | null
  customer: string
}

export interface OrderImportPreview {
  fetched_total: number
  to_import_count: number
  already_imported_count: number
  skipped_count: number
  open_orders_only: boolean
  section: OrderImportPreviewSection
  items: OrderImportPreviewItem[]
  page: number
  limit: number
  total: number
  pages: number
}

export type CatalogPublishRunStatus = 'idle' | 'running' | 'completed' | 'cancelled'

export interface CatalogPublishStatus {
  status: CatalogPublishRunStatus
  run_id: string | null
  total: number
  processed: number
  failed: number
  pending: number
  started_at: string | null
}

export type ImportRunStatus = 'idle' | 'running' | 'completed' | 'cancelled'

export interface ImportRunProgress {
  status: ImportRunStatus
  scope: 'products' | 'orders' | 'customers' | null
  run_id: string | null
  total: number
  processed: number
  failed: number
  pending: number
  started_at: string | null
}

export type CustomerImportPreviewSection = 'to_import' | 'matched_by_email' | 'already_linked' | 'skipped'

export interface CustomerImportPreviewItem {
  woo_customer_id: number
  name: string
  email: string | null
}

export interface CustomerImportPreview {
  woo_total: number
  to_import_count: number
  matched_by_email_count: number
  already_linked_count: number
  skipped_count: number
  section: CustomerImportPreviewSection
  items: CustomerImportPreviewItem[]
  page: number
  limit: number
  total: number
  pages: number
}

export interface CustomerImportApplyResult {
  contacts_created: number
  contacts_linked: number
  already_linked: number
  skipped: number
}

export interface CustomerPushResult {
  created: number
  updated: number
  skipped: number
}
