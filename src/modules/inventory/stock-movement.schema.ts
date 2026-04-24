import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'

export const manualAdjustmentSchema = z.object({
  variant_id:   z.string().uuid(),
  warehouse_id: z.string().uuid(),
  quantity:     z.number().min(0),
  notes:        z.string().nullable().optional(),
})

export const stockMovementQuerySchema = paginationSchema.extend({
  variant_id:     z.string().uuid().optional(),
  warehouse_id:   z.string().uuid().optional(),
  reference_type: z.enum(['order', 'invoice_cancel', 'manual', 'initial']).optional(),
  search:         z.string().optional(),
})

export type ManualAdjustmentInput = z.infer<typeof manualAdjustmentSchema>
export type StockMovementQuery    = z.infer<typeof stockMovementQuerySchema>
