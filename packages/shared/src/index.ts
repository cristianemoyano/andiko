export * from './balanza'

// Primitive types shared between ERP cloud and POS
export type UUID = string

export type ContactType = 'customer' | 'supplier' | 'both'
export type IvaCondition =
  | 'responsable_inscripto'
  | 'monotributista'
  | 'consumidor_final'
  | 'exento'
  | 'no_responsable'

export type IvaRate = '0' | '10.5' | '21' | '27'

export type ApiError = {
  error: string
  code: string
  details?: Record<string, unknown>
}

// POS sync payloads — used by both apps/pos and apps/web API routes
export type PosProduct = {
  id: UUID
  sku: string | null
  barcode: string | null
  name: string
  price: string     // NUMERIC as string to preserve precision; for weight items, price per kg
  iva_rate: IvaRate
  is_active: boolean
  image_url: string | null
  /** Sold by weight (balanza) — price is per kg and qty is fractional kg. */
  sold_by_weight: boolean
  /** PLU/item code embedded in scale labels; matches the scanned barcode's item code. */
  plu_code: string | null
  updated_at: string // ISO timestamp
}

export type PosCustomer = {
  id: UUID
  legal_name: string
  trade_name: string | null
  cuit: string | null
  iva_condition: string | null
  email: string | null
  phone: string | null
  updated_at: string
}

export type PosPaymentMethod = {
  id: UUID
  name: string
  type: string
  requires_reference: boolean
  sort_order: number
  updated_at: string
}

export type PosSaleItem = {
  product_id: UUID
  product_name: string
  qty: number
  unit_price: string
  total: string
  iva_rate?: string
}

export type PosSalePayment = {
  payment_method_id: UUID
  payment_method_name: string
  payment_method_type: string
  /** Monto imputado a la venta (≤ total). */
  amount: string
  /** Efectivo entregado por el cliente (solo type=cash). */
  tendered_amount?: string | null
  reference: string | null
}

export type PosSale = {
  local_id: string  // UUID generated on device
  device_id: string
  ticket_number?: string
  cloud_id?: string | null
  cae?: string | null
  cae_expiration?: string | null
  qr_url?: string | null
  afip_status?: string | null
  cashier_user_id?: UUID | null
  cashier_name?: string | null
  customer_id: UUID | null
  payments: PosSalePayment[]
  subtotal: string
  tax_amount: string
  total: string
  sold_at: string   // ISO timestamp
  items: PosSaleItem[]
}

export type PosSyncSalesPayload = {
  sales: PosSale[]
}

export type PosSyncSalesResult = {
  synced: string[]           // local_ids that were accepted
  errors: { local_id: string; message: string }[]
}

export type PosLicense = {
  valid: boolean
  org_id: UUID
  branch_id: UUID
  device_id: string
  valid_until: string        // ISO timestamp
  features: string[]
}
