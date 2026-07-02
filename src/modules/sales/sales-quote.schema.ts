import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import { IVA_RATES, PAYMENT_CONDITIONS, type IvaRate, type PaymentCondition } from '@/types'
import { QUOTE_STATUSES } from './sales-quote.model'

const ivaRateEnum          = z.enum([...IVA_RATES] as [IvaRate, ...IvaRate[]])
const paymentConditionEnum = z.enum([...PAYMENT_CONDITIONS] as [PaymentCondition, ...PaymentCondition[]])

export const lineItemSchema = z.object({
  product_id:   z.string().uuid(),
  variant_id:   z.string().uuid(),
  description:  z.string().min(1).max(500),
  quantity:     z.coerce.number().positive(),
  unit_price:   z.coerce.number().min(0),
  discount_pct: z.coerce.number().min(0).max(100).default(0),
  iva_rate:     ivaRateEnum.default('21'),
  sort_order:   z.coerce.number().int().min(0).default(0),
})

export const salesQuoteSchema = z.object({
  contact_id:        z.string().uuid(),
  branch_id:         z.string().uuid(),
  price_list_id:     z.string().uuid().nullable().optional(),
  valid_until:       z.string().datetime({ offset: true }).transform(s => new Date(s)).nullable().optional(),
  payment_condition: paymentConditionEnum.default('cash'),
  currency:          z.string().length(3).default('ARS'),
  notes:             z.string().nullable().optional(),
  internal_notes:    z.string().nullable().optional(),
  items:             z.array(lineItemSchema).min(1),
})

export const salesQuoteUpdateSchema = salesQuoteSchema.partial().extend({
  status: z.enum(QUOTE_STATUSES).optional(),
  items:  z.array(lineItemSchema).min(1).optional(),
})

export const salesQuoteQuerySchema = paginationSchema.extend({
  search:     z.string().optional(),
  status:     z.enum(QUOTE_STATUSES).optional(),
  contact_id: z.string().uuid().optional(),
  /** When present, returns draft/sent quotes whose valid_until falls within the next N days. */
  expiring_within_days: z.coerce.number().int().positive().max(90).optional(),
})

export type SalesQuoteInput       = z.infer<typeof salesQuoteSchema>
export type SalesQuoteUpdateInput = z.infer<typeof salesQuoteUpdateSchema>
export type SalesQuoteQuery       = z.infer<typeof salesQuoteQuerySchema>
export type LineItemInput         = z.infer<typeof lineItemSchema>
