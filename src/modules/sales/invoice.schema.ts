import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import { PAYMENT_CONDITIONS, type PaymentCondition } from '@/types'
import { INVOICE_STATUSES } from './invoice.model'
import { lineItemSchema } from './sales-quote.schema'

const paymentConditionEnum = z.enum([...PAYMENT_CONDITIONS] as [PaymentCondition, ...PaymentCondition[]])

export const invoiceSchema = z.object({
  contact_id:        z.string().uuid().nullable().optional(),
  branch_id:         z.string().uuid(),
  order_id:          z.string().uuid().nullable().optional(),
  quote_id:          z.string().uuid().nullable().optional(),
  issue_date:        z.string().datetime({ offset: true }).transform(s => new Date(s)).nullable().optional(),
  due_date:          z.string().datetime({ offset: true }).transform(s => new Date(s)).nullable().optional(),
  payment_condition: paymentConditionEnum.default('cash'),
  currency:          z.string().length(3).default('ARS'),
  notes:             z.string().nullable().optional(),
  internal_notes:    z.string().nullable().optional(),
  items:             z.array(lineItemSchema).min(1),
})

export const invoiceUpdateSchema = invoiceSchema.partial().extend({
  items: z.array(lineItemSchema).min(1).optional(),
})

export const invoiceQuerySchema = paginationSchema.extend({
  search:     z.string().optional(),
  status:     z.enum(INVOICE_STATUSES).optional(),
  contact_id: z.string().uuid().optional(),
  order_id:   z.string().uuid().optional(),
  overdue:    z.coerce.boolean().optional(),
})

export type InvoiceInput       = z.infer<typeof invoiceSchema>
export type InvoiceUpdateInput = z.infer<typeof invoiceUpdateSchema>
export type InvoiceQuery       = z.infer<typeof invoiceQuerySchema>
