import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'

export const stockLevelQuerySchema = paginationSchema.extend({
  warehouse_id: z.string().uuid().optional(),
})

export type StockLevelQuery = z.infer<typeof stockLevelQuerySchema>
