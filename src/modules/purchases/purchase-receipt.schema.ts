import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import { PURCHASE_RECEIPT_STATUSES } from './purchase-receipt.model'

export const receiptItemSchema = z.object({
  order_item_id: z.string().uuid().nullable().optional(),
  product_id:    z.string().uuid().nullable().optional(),
  variant_id:    z.string().uuid().nullable().optional(),
  description:   z.string().min(1).max(500),
  quantity:      z.coerce.number().positive(),
  unit_cost:     z.coerce.number().min(0).default(0),
  sort_order:    z.coerce.number().int().min(0).default(0),
  batch_code:    z.string().trim().min(1).max(100).nullable().optional(),
  expiry_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD').nullable().optional(),
})

export const purchaseReceiptSchema = z.object({
  branch_id:     z.string().uuid(),
  order_id:      z.string().uuid().nullable().optional(),
  contact_id:    z.string().uuid().nullable().optional(),
  warehouse_id:  z.string().uuid().nullable().optional(),
  receipt_date:  z.string().datetime({ offset: true }).transform(s => new Date(s)).nullable().optional(),
  notes:         z.string().nullable().optional(),
  internal_notes: z.string().nullable().optional(),
  items:         z.array(receiptItemSchema).min(1),
})

export const purchaseReceiptUpdateSchema = purchaseReceiptSchema.partial().extend({
  items: z.array(receiptItemSchema).min(1).optional(),
})

export const purchaseReceiptQuerySchema = paginationSchema.extend({
  search:       z.string().optional(),
  status:       z.enum(PURCHASE_RECEIPT_STATUSES).optional(),
  contact_id:   z.string().uuid().optional(),
  order_id:     z.string().uuid().optional(),
  warehouse_id: z.string().uuid().optional(),
})

export const purchaseReceiptStatusCountsQuerySchema = purchaseReceiptQuerySchema.pick({
  search: true,
  contact_id: true,
  order_id: true,
  warehouse_id: true,
})

export type PurchaseReceiptInput       = z.infer<typeof purchaseReceiptSchema>
export type PurchaseReceiptUpdateInput = z.infer<typeof purchaseReceiptUpdateSchema>
export type PurchaseReceiptQuery       = z.infer<typeof purchaseReceiptQuerySchema>
export type PurchaseReceiptStatusCountsQuery = z.infer<typeof purchaseReceiptStatusCountsQuerySchema>
export type ReceiptItemInput           = z.infer<typeof receiptItemSchema>
