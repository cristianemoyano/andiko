import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import { IVA_RATES, PAYMENT_CONDITIONS, type IvaRate, type PaymentCondition } from '@/types'
import { SUPPLIER_INVOICE_STATUSES } from './supplier-invoice.model'

const ivaRateEnum          = z.enum([...IVA_RATES] as [IvaRate, ...IvaRate[]])
const paymentConditionEnum = z.enum([...PAYMENT_CONDITIONS] as [PaymentCondition, ...PaymentCondition[]])

export const supplierInvoiceLineItemSchema = z.object({
  product_id:   z.string().uuid().nullable().optional(),
  variant_id:   z.string().uuid().nullable().optional(),
  description:  z.string().min(1).max(500),
  quantity:     z.coerce.number().positive(),
  unit_price:   z.coerce.number().min(0),
  discount_pct: z.coerce.number().min(0).max(100).default(0),
  iva_rate:     ivaRateEnum.default('21'),
  sort_order:   z.coerce.number().int().min(0).default(0),
})

export const supplierInvoiceSchema = z.object({
  branch_id:               z.string().uuid(),
  contact_id:              z.string().uuid().nullable().optional(),
  order_id:                z.string().uuid().nullable().optional(),
  receipt_id:              z.string().uuid().nullable().optional(),
  supplier_invoice_number: z.string().max(50).nullable().optional(),
  invoice_date:            z.string().datetime({ offset: true }).transform(s => new Date(s)).nullable().optional(),
  due_date:                z.string().datetime({ offset: true }).transform(s => new Date(s)).nullable().optional(),
  payment_condition:       paymentConditionEnum.default('cash'),
  currency:                z.string().length(3).default('ARS'),
  notes:                   z.string().nullable().optional(),
  internal_notes:          z.string().nullable().optional(),
  items:                   z.array(supplierInvoiceLineItemSchema).min(1),
})

export const supplierInvoiceUpdateSchema = supplierInvoiceSchema.partial().extend({
  items: z.array(supplierInvoiceLineItemSchema).min(1).optional(),
})

export const supplierInvoiceQuerySchema = paginationSchema.extend({
  search:     z.string().optional(),
  status:     z.enum(SUPPLIER_INVOICE_STATUSES).optional(),
  contact_id: z.string().uuid().optional(),
  order_id:   z.string().uuid().optional(),
  overdue:    z.coerce.boolean().optional(),
})

export type SupplierInvoiceInput       = z.infer<typeof supplierInvoiceSchema>
export type SupplierInvoiceUpdateInput = z.infer<typeof supplierInvoiceUpdateSchema>
export type SupplierInvoiceQuery       = z.infer<typeof supplierInvoiceQuerySchema>
