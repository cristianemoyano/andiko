import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'

export const manualAdjustmentSchema = z.object({
  variant_id:   z.string().uuid(),
  warehouse_id: z.string().uuid(),
  quantity:     z.number().min(0),
  notes:        z.string().nullable().optional(),
  /** Optional lot for the increased quantity (ignored when adjusting down). */
  batch_code:   z.string().trim().min(1).max(100).nullable().optional(),
  expiry_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD').nullable().optional(),
})

export const stockMovementQuerySchema = paginationSchema.extend({
  variant_id:     z.string().uuid().optional(),
  warehouse_id:   z.string().uuid().optional(),
  reference_type: z.enum([
    'order', 'invoice_cancel', 'manual', 'initial', 'transfer',
    'purchase_receipt', 'delivery_note', 'sales_return',
  ]).optional(),
  search:         z.string().optional(),
})

export type ManualAdjustmentInput = z.infer<typeof manualAdjustmentSchema>
export type StockMovementQuery    = z.infer<typeof stockMovementQuerySchema>
