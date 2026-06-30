import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import {
  SALES_RETURN_STATUSES,
  SALES_RETURN_OPERATION_TYPES,
  REFUND_DISPOSITIONS,
} from './sales-return.model'
import { REFUND_METHODS } from './sales-refund.model'
import { lineItemSchema } from './sales-quote.schema'

export const returnItemInputSchema = z.object({
  order_item_id: z.string().uuid().optional(),
  product_id:    z.string().uuid().optional(),
  variant_id:    z.string().uuid().nullable().optional(),
  description:   z.string().min(1).max(500).optional(),
  quantity:      z.coerce.number().positive(),
  batch_code:    z.string().max(100).nullable().optional(),
  expiry_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
}).superRefine((data, ctx) => {
  if (!data.order_item_id && !data.product_id && !data.description) {
    ctx.addIssue({ code: 'custom', message: 'order_item_id, product_id or description required', path: ['order_item_id'] })
  }
})

export const exchangeItemInputSchema = lineItemSchema

export const createSalesReturnSchema = z.object({
  order_id:           z.string().uuid(),
  operation_type:     z.enum(SALES_RETURN_OPERATION_TYPES).default('return'),
  warehouse_id:       z.string().uuid().optional(),
  reason:             z.string().max(500).optional(),
  notes:              z.string().max(1000).optional(),
  items:              z.array(returnItemInputSchema).min(1),
  exchange_items:     z.array(exchangeItemInputSchema).optional(),
  pos_local_id:       z.string().max(128).optional(),
}).superRefine((data, ctx) => {
  if (data.operation_type === 'exchange' && (!data.exchange_items || data.exchange_items.length === 0)) {
    ctx.addIssue({ code: 'custom', message: 'exchange_items required for exchange', path: ['exchange_items'] })
  }
})

export const updateSalesReturnSchema = z.object({
  warehouse_id:   z.string().uuid().optional(),
  reason:         z.string().max(500).optional(),
  notes:          z.string().max(1000).optional(),
  items:          z.array(returnItemInputSchema).min(1).optional(),
  exchange_items: z.array(exchangeItemInputSchema).optional(),
})

export const completeSalesReturnSchema = z.object({
  refund_disposition: z.enum(REFUND_DISPOSITIONS).optional(),
  refund_method:      z.enum(REFUND_METHODS).optional(),
  refund_amount:      z.coerce.number().positive().optional(),
  refund_reference:   z.string().max(255).optional(),
  refund_notes:       z.string().max(1000).optional(),
  payment_id:         z.string().uuid().optional(),
})

export const salesReturnQuerySchema = paginationSchema.extend({
  search:         z.string().optional(),
  status:         z.enum(SALES_RETURN_STATUSES).optional(),
  order_id:       z.string().uuid().optional(),
  operation_type: z.enum(SALES_RETURN_OPERATION_TYPES).optional(),
})

export type CreateSalesReturnInput = z.infer<typeof createSalesReturnSchema>
export type UpdateSalesReturnInput = z.infer<typeof updateSalesReturnSchema>
export type CompleteSalesReturnInput = z.infer<typeof completeSalesReturnSchema>
export type SalesReturnQuery = z.infer<typeof salesReturnQuerySchema>
