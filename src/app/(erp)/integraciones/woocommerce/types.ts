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

export interface ImportPreview {
  woo_total: number
  matched: { sku: string; name: string }[]
  to_import: { sku: string; name: string }[]
  needs_mapping: { name: string; reason: string }[]
}
