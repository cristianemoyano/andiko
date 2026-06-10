import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'

export const reconciliationQuerySchema = paginationSchema.extend({
  search:           z.string().optional(),
  only_differences: z.coerce.boolean().optional(),
})

export type ReconciliationQuery = z.infer<typeof reconciliationQuerySchema>
