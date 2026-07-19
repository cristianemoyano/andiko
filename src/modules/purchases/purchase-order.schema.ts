import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import { IVA_RATES, PAYMENT_CONDITIONS, type IvaRate, type PaymentCondition } from '@/types'
import { PURCHASE_ORDER_STATUSES } from './purchase-order.model'

const ivaRateEnum          = z.enum([...IVA_RATES] as [IvaRate, ...IvaRate[]])
const paymentConditionEnum = z.enum([...PAYMENT_CONDITIONS] as [PaymentCondition, ...PaymentCondition[]])

export const purchaseLineItemSchema = z.object({
  product_id:   z.string().uuid().nullable().optional(),
  variant_id:   z.string().uuid().nullable().optional(),
  description:  z.string().min(1).max(500),
  quantity:     z.coerce.number().positive(),
  unit_price:   z.coerce.number().min(0),
  discount_pct: z.coerce.number().min(0).max(100).default(0),
  iva_rate:     ivaRateEnum.default('21'),
  sort_order:   z.coerce.number().int().min(0).default(0),
})

export const purchaseOrderSchema = z.object({
  branch_id:         z.string().uuid(),
  contact_id:        z.string().uuid().nullable().optional(),
  expected_date:     z.string().datetime({ offset: true }).transform(s => new Date(s)).nullable().optional(),
  payment_condition: paymentConditionEnum.default('cash'),
  currency:          z.string().length(3).default('ARS'),
  notes:             z.string().nullable().optional(),
  internal_notes:    z.string().nullable().optional(),
  items:             z.array(purchaseLineItemSchema).min(1),
})

export const purchaseOrderUpdateSchema = purchaseOrderSchema.partial().extend({
  status: z.enum(PURCHASE_ORDER_STATUSES).optional(),
  items:  z.array(purchaseLineItemSchema).min(1).optional(),
})

export const purchaseOrderQuerySchema = paginationSchema.extend({
  search:     z.string().optional(),
  status:     z.enum(PURCHASE_ORDER_STATUSES).optional(),
  contact_id: z.string().uuid().optional(),
})

export const purchaseOrderStatusCountsQuerySchema = purchaseOrderQuerySchema.pick({
  search: true,
  contact_id: true,
})

export type PurchaseOrderInput       = z.infer<typeof purchaseOrderSchema>
export type PurchaseOrderUpdateInput = z.infer<typeof purchaseOrderUpdateSchema>
export type PurchaseOrderQuery       = z.infer<typeof purchaseOrderQuerySchema>
export type PurchaseOrderStatusCountsQuery = z.infer<typeof purchaseOrderStatusCountsQuerySchema>
export type PurchaseLineItemInput    = z.infer<typeof purchaseLineItemSchema>
