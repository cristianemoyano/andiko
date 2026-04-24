import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'

export const warehouseSchema = z.object({
  name:        z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  branch_id:   z.string().uuid().nullable().optional(),
  is_active:   z.boolean().optional(),
})

export const warehouseUpdateSchema = warehouseSchema.partial()

export const warehouseQuerySchema = paginationSchema.extend({
  search:    z.string().optional(),
  branch_id: z.string().uuid().optional(),
})

export type WarehouseInput       = z.infer<typeof warehouseSchema>
export type WarehouseUpdateInput = z.infer<typeof warehouseUpdateSchema>
export type WarehouseQuery       = z.infer<typeof warehouseQuerySchema>
