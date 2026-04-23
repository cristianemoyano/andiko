import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import { PAYMENT_CONDITIONS, type PaymentCondition } from '@/types'
import { ORDER_STATUSES } from './sales-order.model'
import { lineItemSchema } from './sales-quote.schema'

const paymentConditionEnum = z.enum([...PAYMENT_CONDITIONS] as [PaymentCondition, ...PaymentCondition[]])

export const salesOrderSchema = z.object({
  contact_id:        z.string().uuid().nullable().optional(),
  branch_id:         z.string().uuid(),
  quote_id:          z.string().uuid().nullable().optional(),
  price_list_id:     z.string().uuid().nullable().optional(),
  payment_condition: paymentConditionEnum.default('cash'),
  currency:          z.string().length(3).default('ARS'),
  promised_date:     z.string().datetime({ offset: true }).transform(s => new Date(s)).nullable().optional(),
  notes:             z.string().nullable().optional(),
  internal_notes:    z.string().nullable().optional(),
  items:             z.array(lineItemSchema).min(1),
})

export const salesOrderUpdateSchema = salesOrderSchema.partial().extend({
  status:         z.enum(ORDER_STATUSES).optional(),
  delivered_date: z.string().datetime({ offset: true }).transform(s => new Date(s)).nullable().optional(),
  items:          z.array(lineItemSchema).min(1).optional(),
})

export const salesOrderQuerySchema = paginationSchema.extend({
  search:     z.string().optional(),
  status:     z.enum(ORDER_STATUSES).optional(),
  contact_id: z.string().uuid().optional(),
  quote_id:   z.string().uuid().optional(),
})

export type SalesOrderInput       = z.infer<typeof salesOrderSchema>
export type SalesOrderUpdateInput = z.infer<typeof salesOrderUpdateSchema>
export type SalesOrderQuery       = z.infer<typeof salesOrderQuerySchema>
