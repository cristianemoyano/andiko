import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'

export const productCategorySchema = z.object({
  name:        z.string().min(1).max(100),
  parent_id:   z.string().uuid().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  status:      z.enum(['active', 'archived']).optional(),
})

export const productCategoryUpdateSchema = productCategorySchema.partial()

export const productCategoryQuerySchema = paginationSchema.extend({
  search:    z.string().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  status:    z.enum(['active', 'archived']).optional(),
})

export type ProductCategoryInput       = z.infer<typeof productCategorySchema>
export type ProductCategoryUpdateInput = z.infer<typeof productCategoryUpdateSchema>
export type ProductCategoryQuery       = z.infer<typeof productCategoryQuerySchema>
