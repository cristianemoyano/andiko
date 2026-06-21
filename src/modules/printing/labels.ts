import type { PaymentCondition } from '@/types'

export const PAYMENT_CONDITION_LABEL: Record<PaymentCondition, string> = {
  cash:   'Contado',
  net_30: '30 días',
  net_60: '60 días',
  net_90: '90 días',
}

export const QUOTE_STATUS_LABEL: Record<string, string> = {
  draft:     'Borrador',
  sent:      'Enviado',
  accepted:  'Aceptado',
  rejected:  'Rechazado',
  expired:   'Vencido',
  cancelled: 'Cancelado',
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  draft:       'Borrador',
  confirmed:   'Confirmado',
  in_progress: 'En proceso',
  delivered:   'Entregado',
  cancelled:   'Cancelado',
}

export const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft:          'Borrador',
  issued:         'Emitida',
  partially_paid: 'Pago parcial',
  paid:           'Pagada',
  cancelled:      'Anulada',
}

export const CREDIT_NOTE_STATUS_LABEL: Record<string, string> = {
  draft:     'Borrador',
  issued:    'Emitida',
  cancelled: 'Anulada',
}

export const DEBIT_NOTE_STATUS_LABEL: Record<string, string> = {
  draft:     'Borrador',
  issued:    'Emitida',
  cancelled: 'Anulada',
}

export const DELIVERY_NOTE_STATUS_LABEL: Record<string, string> = {
  draft:     'Borrador',
  issued:    'Emitido',
  delivered: 'Entregado',
  annulled:  'Anulado',
}

export const PURCHASE_ORDER_STATUS_LABEL: Record<string, string> = {
  draft:              'Borrador',
  sent:               'Enviada',
  partially_received: 'Parcialmente recibida',
  received:           'Recibida',
  cancelled:          'Cancelada',
}

export const PURCHASE_RECEIPT_STATUS_LABEL: Record<string, string> = {
  draft:     'Borrador',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
}

export const SUPPLIER_INVOICE_STATUS_LABEL: Record<string, string> = {
  draft:          'Borrador',
  received:       'Recibida',
  partially_paid: 'Pago parcial',
  paid:           'Pagada',
  cancelled:      'Anulada',
}

const SALES_PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash:     'Efectivo',
  transfer: 'Transferencia',
  check:    'Cheque',
  card:     'Tarjeta',
  other:    'Otro',
}

const PURCHASE_PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash:     'Efectivo',
  transfer: 'Transferencia',
  check:    'Cheque',
  card:     'Tarjeta',
  other:    'Otro',
}

export function labelSalesPaymentMethod(code: string): string {
  return SALES_PAYMENT_METHOD_LABEL[code] ?? code
}

export function labelPurchasePaymentMethod(code: string): string {
  return PURCHASE_PAYMENT_METHOD_LABEL[code] ?? code
}
