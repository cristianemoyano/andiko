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
  price: string     // NUMERIC as string to preserve precision
  iva_rate: IvaRate
  is_active: boolean
  image_url: string | null
  updated_at: string // ISO timestamp
}

export type PosCustomer = {
  id: UUID
  legal_name: string
  trade_name: string | null
  cuit: string | null
  email: string | null
  phone: string | null
  updated_at: string
}

export type PosSaleItem = {
  product_id: UUID
  product_name: string
  qty: number
  unit_price: string
  total: string
}

export type PosSale = {
  local_id: string  // UUID generated on device
  device_id: string
  cashier_user_id?: UUID | null
  cashier_name?: string | null
  customer_id: UUID | null
  payment_method: 'cash' | 'card' | 'transfer'
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
