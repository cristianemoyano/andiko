import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'

export const priceListSchema = z.object({
  name:        z.string().min(1).max(100),
  description: z.string().max(255).nullable().optional(),
  is_default:  z.boolean().optional(),
  is_active:   z.boolean().optional(),
})

export const priceListUpdateSchema = priceListSchema.partial()

export const priceListQuerySchema = paginationSchema.extend({
  search:    z.string().optional(),
  is_active: z.coerce.boolean().optional(),
})

export const priceListItemSchema = z.object({
  product_variant_id: z.string().uuid(),
  price:              z.string().regex(/^\d+(\.\d{1,2})?$/, 'Precio inválido'),
})

export type PriceListInput       = z.infer<typeof priceListSchema>
export type PriceListUpdateInput = z.infer<typeof priceListUpdateSchema>
export type PriceListQuery       = z.infer<typeof priceListQuerySchema>
export type PriceListItemInput   = z.infer<typeof priceListItemSchema>
