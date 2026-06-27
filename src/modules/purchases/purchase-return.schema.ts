import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import { IVA_RATES, type IvaRate } from '@/types'
import { PURCHASE_RETURN_STATUSES, PURCHASE_RETURN_OPERATION_TYPES } from './purchase-return.model'

const ivaRateEnum = z.enum([...IVA_RATES] as [IvaRate, ...IvaRate[]])

export const purchaseReturnItemInputSchema = z.object({
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

export const purchaseExchangeItemInputSchema = z.object({
  product_id:   z.string().uuid().nullable().optional(),
  variant_id:   z.string().uuid().nullable().optional(),
  description:  z.string().min(1).max(500),
  quantity:     z.coerce.number().positive(),
  unit_price:   z.coerce.number().min(0),
  discount_pct: z.coerce.number().min(0).max(100).default(0),
  iva_rate:     ivaRateEnum.default('21'),
  batch_code:   z.string().max(100).nullable().optional(),
  expiry_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  sort_order:   z.coerce.number().int().min(0).default(0),
})

export const createPurchaseReturnSchema = z.object({
  order_id:       z.string().uuid(),
  operation_type: z.enum(PURCHASE_RETURN_OPERATION_TYPES).default('return'),
  warehouse_id:   z.string().uuid().optional(),
  reason:         z.string().max(500).optional(),
  notes:          z.string().max(1000).optional(),
  items:          z.array(purchaseReturnItemInputSchema).min(1),
  exchange_items: z.array(purchaseExchangeItemInputSchema).optional(),
}).superRefine((data, ctx) => {
  if (data.operation_type === 'exchange' && (!data.exchange_items || data.exchange_items.length === 0)) {
    ctx.addIssue({ code: 'custom', message: 'exchange_items required for exchange', path: ['exchange_items'] })
  }
})

export const updatePurchaseReturnSchema = z.object({
  warehouse_id:   z.string().uuid().optional(),
  reason:         z.string().max(500).optional(),
  notes:          z.string().max(1000).optional(),
  items:          z.array(purchaseReturnItemInputSchema).min(1).optional(),
  exchange_items: z.array(purchaseExchangeItemInputSchema).optional(),
})

export const completePurchaseReturnSchema = z.object({
  notes: z.string().max(1000).optional(),
})

export const purchaseReturnQuerySchema = paginationSchema.extend({
  search:         z.string().optional(),
  status:         z.enum(PURCHASE_RETURN_STATUSES).optional(),
  order_id:       z.string().uuid().optional(),
  operation_type: z.enum(PURCHASE_RETURN_OPERATION_TYPES).optional(),
})

export type CreatePurchaseReturnInput   = z.infer<typeof createPurchaseReturnSchema>
export type UpdatePurchaseReturnInput   = z.infer<typeof updatePurchaseReturnSchema>
export type CompletePurchaseReturnInput = z.infer<typeof completePurchaseReturnSchema>
export type PurchaseReturnQuery         = z.infer<typeof purchaseReturnQuerySchema>
