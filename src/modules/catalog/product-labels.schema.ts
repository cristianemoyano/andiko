import { z } from 'zod'

export const productLabelsQuerySchema = z.object({
  page:  z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(100),
  search: z.string().optional(),
  category_id: z.string().uuid().optional(),
})

export type ProductLabelsQuery = z.infer<typeof productLabelsQuerySchema>
