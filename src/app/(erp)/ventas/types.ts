import type { IvaRate, PaymentCondition } from '@/types'

export type { IvaRate, PaymentCondition }

/** Sucursal (listados / detalle de ventas). */
export interface BranchSummary {
  id: string
  name: string
  branch_code: number
}

export const PAYMENT_CONDITION_LABEL: Record<PaymentCondition, string> = {
  cash:   'Contado',
  net_30: '30 días',
  net_60: '60 días',
  net_90: '90 días',
}

// --- Quote ---

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'cancelled'

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  draft:    'Borrador',
  sent:     'Enviado',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  expired:  'Vencido',
  cancelled: 'Cancelado',
}

export interface QuoteItem {
  id: string
  product_id: string | null
  variant_id: string | null
  description: string
  quantity: string
  unit_price: string
  discount_pct: string
  iva_rate: IvaRate
  subtotal: string
  discount_amount: string
  tax_amount: string
  total: string
  sort_order: number
}

export interface Quote {
  id: string
  branch_id: string | null
  contact_id: string | null
  price_list_id: string | null
  quote_number: string
  status: QuoteStatus
  valid_until: string | null
  payment_condition: PaymentCondition
  currency: string
  subtotal: string
  discount_amount: string
  tax_amount: string
  total: string
  notes: string | null
  internal_notes: string | null
  created_at: string
  updated_at: string
  branch?: BranchSummary | null
  contact?: { id: string; legal_name: string; trade_name: string | null } | null
  salesperson?: { id: string; name: string } | null
  items?: QuoteItem[]
}

// --- Order ---

export type OrderStatus = 'draft' | 'confirmed' | 'in_progress' | 'delivered' | 'cancelled'

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  draft:       'Borrador',
  confirmed:   'Confirmado',
  in_progress: 'En proceso',
  delivered:   'Entregado',
  cancelled:   'Cancelado',
}

export interface OrderItem {
  id: string
  product_id: string | null
  variant_id: string | null
  description: string
  quantity: string
  unit_price: string
  discount_pct: string
  iva_rate: IvaRate
  subtotal: string
  discount_amount: string
  tax_amount: string
  total: string
  sort_order: number
}

export interface Order {
  id: string
  branch_id: string | null
  contact_id: string | null
  quote_id: string | null
  price_list_id: string | null
  order_number: string
  status: OrderStatus
  promised_date: string | null
  payment_condition: PaymentCondition
  currency: string
  shipping_street: string | null
  shipping_number: string | null
  shipping_floor: string | null
  shipping_apartment: string | null
  shipping_city: string | null
  shipping_province: string | null
  shipping_postal_code: string | null
  shipping_country: string | null
  billing_street: string | null
  billing_number: string | null
  billing_floor: string | null
  billing_apartment: string | null
  billing_city: string | null
  billing_province: string | null
  billing_postal_code: string | null
  billing_country: string | null
  subtotal: string
  discount_amount: string
  tax_amount: string
  total: string
  notes: string | null
  internal_notes: string | null
  created_at: string
  updated_at: string
  branch?: BranchSummary | null
  contact?: { id: string; legal_name: string; trade_name: string | null } | null
  salesperson?: { id: string; name: string } | null
  items?: OrderItem[]
}

// --- Payment (matches API / `payments` model; used by invoice detail) ---

export type PaymentMethod = 'cash' | 'transfer' | 'check' | 'card' | 'other'

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash:     'Efectivo',
  transfer: 'Transferencia',
  check:    'Cheque',
  card:     'Tarjeta',
  other:    'Otro',
}

export interface Payment {
  id: string
  payment_number: string
  invoice_id: string
  payment_date: string
  amount: string
  payment_method: PaymentMethod
  reference: string | null
  notes: string | null
  created_at: string
  salesperson?: { id: string; name: string } | null
}

// --- Invoice ---

export type InvoiceStatus = 'draft' | 'issued' | 'partially_paid' | 'paid' | 'cancelled'

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft:          'Borrador',
  issued:         'Emitida',
  partially_paid: 'Pago parcial',
  paid:           'Pagada',
  cancelled:      'Anulada',
}

export interface InvoiceItem {
  id: string
  product_id: string | null
  variant_id: string | null
  description: string
  quantity: string
  unit_price: string
  discount_pct: string
  iva_rate: IvaRate
  subtotal: string
  discount_amount: string
  tax_amount: string
  total: string
  sort_order: number
}

export interface Invoice {
  id: string
  branch_id: string | null
  contact_id: string | null
  order_id: string
  quote_id: string | null
  price_list_id: string | null
  invoice_number: string
  status: InvoiceStatus
  issue_date: string | null
  due_date: string | null
  payment_condition: PaymentCondition
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
  updated_at: string
  branch?: BranchSummary | null
  contact?: { id?: string; legal_name: string; trade_name: string | null } | null
  salesperson?: { id: string; name: string } | null
  items?: InvoiceItem[]
  /** Present on GET `/api/v1/sales/invoices/:id` when backend includes payments */
  payments?: Payment[]
}

// --- Account statement (cuenta corriente) ---

export type AccountDebtStatus = 'up_to_date' | 'with_balance' | 'overdue'
export type AccountMovementType = 'invoice' | 'payment' | 'credit_note'

export const ACCOUNT_DEBT_STATUS_LABEL: Record<AccountDebtStatus, string> = {
  up_to_date: 'Al día',
  with_balance: 'Con saldo',
  overdue: 'Vencido',
}

export const ACCOUNT_MOVEMENT_TYPE_LABEL: Record<AccountMovementType, string> = {
  invoice:     'Factura',
  payment:     'Cobro',
  credit_note: 'Nota de crédito',
}

export interface AccountStatementSummary {
  currency: string
  total_invoiced: string
  total_paid: string
  balance: string
  overdue_balance: string
  current_balance: string
  debt_status: AccountDebtStatus
}

export interface AccountStatementLine {
  id: string
  movement_type: AccountMovementType
  movement_id: string
  date: string
  document_number: string
  description: string | null
  due_date: string | null
  debit: string
  credit: string
  running_balance: string
}

export interface AccountStatementResponse {
  contact: {
    id: string
    legal_name: string
    trade_name: string | null
  }
  summary: AccountStatementSummary
  data: AccountStatementLine[]
  total: number
  page: number
  limit: number
  pages: number
}
