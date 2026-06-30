import { z } from 'zod'

export const bulkDeleteProductsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
})

export type BulkDeleteProductsInput = z.infer<typeof bulkDeleteProductsSchema>
