import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import { PAYMENT_CONDITIONS, type PaymentCondition } from '@/types'
import { ORDER_STATUSES, SALES_ORDER_SOURCES } from './sales-order.model'
import { lineItemSchema } from './sales-quote.schema'
import { WOO_ORDER_STATUS_SLUGS } from '@/modules/integrations/woocommerce/woo-order-status.utils'

const paymentConditionEnum = z.enum([...PAYMENT_CONDITIONS] as [PaymentCondition, ...PaymentCondition[]])

export const salesOrderSchema = z.object({
  contact_id:        z.string().uuid(),
  branch_id:         z.string().uuid(),
  quote_id:          z.string().uuid().nullable().optional(),
  price_list_id:     z.string().uuid().nullable().optional(),
  payment_condition: paymentConditionEnum.default('cash'),
  currency:          z.string().length(3).default('ARS'),
  promised_date:     z.string().datetime({ offset: true }).transform(s => new Date(s)).nullable().optional(),
  shipping_street: z.string().max(255).nullable().optional(),
  shipping_number: z.string().max(20).nullable().optional(),
  shipping_floor: z.string().max(20).nullable().optional(),
  shipping_apartment: z.string().max(20).nullable().optional(),
  shipping_city: z.string().max(100).nullable().optional(),
  shipping_province: z.string().max(100).nullable().optional(),
  shipping_postal_code: z.string().max(10).nullable().optional(),
  shipping_country: z.string().max(100).nullable().optional(),
  billing_street: z.string().max(255).nullable().optional(),
  billing_number: z.string().max(20).nullable().optional(),
  billing_floor: z.string().max(20).nullable().optional(),
  billing_apartment: z.string().max(20).nullable().optional(),
  billing_city: z.string().max(100).nullable().optional(),
  billing_province: z.string().max(100).nullable().optional(),
  billing_postal_code: z.string().max(10).nullable().optional(),
  billing_country: z.string().max(100).nullable().optional(),
  notes:             z.string().nullable().optional(),
  internal_notes:    z.string().nullable().optional(),
  items:             z.array(lineItemSchema).min(1),
})

export const salesOrderUpdateSchema = salesOrderSchema
  .omit({ payment_condition: true, currency: true })
  .partial()
  .extend({
    payment_condition: paymentConditionEnum.optional(),
    currency:          z.string().length(3).optional(),
    status:            z.enum(ORDER_STATUSES).optional(),
    delivered_date:    z.string().datetime({ offset: true }).transform(s => new Date(s)).nullable().optional(),
    items:             z.array(lineItemSchema).min(1).optional(),
  })

export const salesOrderQuerySchema = paginationSchema.extend({
  search:     z.string().optional(),
  status:     z.enum(ORDER_STATUSES).optional(),
  contact_id: z.string().uuid().optional(),
  quote_id:   z.string().uuid().optional(),
  source:     z.enum(SALES_ORDER_SOURCES).optional(),
  woo_status: z.enum(WOO_ORDER_STATUS_SLUGS).optional(),
  branch_id:  z.string().uuid().optional(),
  from:       z.coerce.date().optional(),
  to:         z.coerce.date().optional(),
}).superRefine((value, ctx) => {
  if (value.from && value.to && value.from > value.to) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'from must be <= to',
      path: ['from'],
    })
  }
})

export type SalesOrderInput       = z.infer<typeof salesOrderSchema>
export type SalesOrderUpdateInput = z.infer<typeof salesOrderUpdateSchema>
export type SalesOrderQuery       = z.infer<typeof salesOrderQuerySchema>
