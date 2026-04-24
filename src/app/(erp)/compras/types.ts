export type PurchaseOrderStatus = 'draft' | 'sent' | 'partially_received' | 'received' | 'cancelled'
export type PurchaseReceiptStatus = 'draft' | 'confirmed' | 'cancelled'
export type SupplierInvoiceStatus = 'draft' | 'received' | 'partially_paid' | 'paid' | 'cancelled'
export type PaymentMethod = 'transfer' | 'check' | 'cash' | 'credit_card' | 'debit_card' | 'other'

export const PURCHASE_ORDER_STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  draft:              'Borrador',
  sent:               'Enviado',
  partially_received: 'Recibido parcial',
  received:           'Recibido',
  cancelled:          'Cancelado',
}

export const PURCHASE_RECEIPT_STATUS_LABEL: Record<PurchaseReceiptStatus, string> = {
  draft:     'Borrador',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
}

export const SUPPLIER_INVOICE_STATUS_LABEL: Record<SupplierInvoiceStatus, string> = {
  draft:           'Borrador',
  received:        'Recibida',
  partially_paid:  'Pago parcial',
  paid:            'Pagada',
  cancelled:       'Cancelada',
}

export const PAYMENT_CONDITION_LABEL: Record<string, string> = {
  cash:   'Contado',
  net_30: '30 días',
  net_60: '60 días',
  net_90: '90 días',
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  transfer:    'Transferencia',
  check:       'Cheque',
  cash:        'Efectivo',
  credit_card: 'Tarjeta crédito',
  debit_card:  'Tarjeta débito',
  other:       'Otro',
}

export type Branch = { id: string; name: string; branch_code: number }
export type ContactSummary = { id: string; legal_name: string; trade_name: string | null }
export type WarehouseSummary = { id: string; name: string }

export type LineItem = {
  id: string
  description: string
  quantity: string
  received_qty?: string
  unit_price: string
  discount_pct: string
  iva_rate: string
  subtotal: string
  discount_amount: string
  tax_amount: string
  total: string
  sort_order: number
  product_id: string | null
  variant_id: string | null
}

export type PurchaseOrder = {
  id: string
  order_number: string
  status: PurchaseOrderStatus
  contact_id: string | null
  branch_id: string | null
  expected_date: string | null
  payment_condition: string
  currency: string
  subtotal: string
  discount_amount: string
  tax_amount: string
  total: string
  notes: string | null
  internal_notes: string | null
  created_at: string
  branch: Branch | null
  contact: ContactSummary | null
  items: LineItem[]
}

export type PurchaseReceipt = {
  id: string
  receipt_number: string
  status: PurchaseReceiptStatus
  order_id: string | null
  contact_id: string | null
  branch_id: string | null
  warehouse_id: string | null
  receipt_date: string | null
  notes: string | null
  internal_notes: string | null
  created_at: string
  branch: Branch | null
  contact: ContactSummary | null
  warehouse: WarehouseSummary | null
  items: Array<{
    id: string
    description: string
    quantity: string
    unit_cost: string
    sort_order: number
    order_item_id: string | null
    variant_id: string | null
  }>
}

export type SupplierInvoice = {
  id: string
  invoice_number: string
  supplier_invoice_number: string | null
  status: SupplierInvoiceStatus
  contact_id: string | null
  branch_id: string | null
  order_id: string | null
  receipt_id: string | null
  invoice_date: string | null
  due_date: string | null
  payment_condition: string
  currency: string
  subtotal: string
  discount_amount: string
  tax_amount: string
  total: string
  paid_amount: string
  balance: string
  notes: string | null
  internal_notes: string | null
  created_at: string
  branch: Branch | null
  contact: ContactSummary | null
  items: LineItem[]
  payments: SupplierPayment[]
}

export type SupplierPayment = {
  id: string
  payment_number: string
  invoice_id: string
  amount: string
  payment_date: string
  payment_method: string
  notes: string | null
  created_at: string
}
