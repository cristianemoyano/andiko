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

export const priceListItemsQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
})

export const clonePriceListSchema = z.object({
  name:        z.string().min(1).max(100),
  description: z.string().max(255).nullable().optional(),
  is_active:   z.boolean().optional(),
})

export type PriceListInput       = z.infer<typeof priceListSchema>
export type PriceListUpdateInput = z.infer<typeof priceListUpdateSchema>
export type PriceListQuery       = z.infer<typeof priceListQuerySchema>
export type PriceListItemInput   = z.infer<typeof priceListItemSchema>
export type PriceListItemsQuery  = z.infer<typeof priceListItemsQuerySchema>
export type ClonePriceListInput  = z.infer<typeof clonePriceListSchema>

export const fillPriceListFromCatalogSchema = z.object({
  /** Si se omite, incluye productos activos de todas las categorías. */
  category_id: z.string().uuid().optional(),
  /** Incluir variantes sin precio base cargándolas a $0. Por defecto no. */
  include_without_price: z.boolean().optional().default(false),
  dry_run: z.boolean().optional().default(false),
})

export type FillPriceListFromCatalogInput = z.infer<typeof fillPriceListFromCatalogSchema>

export interface FillPriceListFromCatalogResult {
  added: number
  skipped_existing: number
  skipped_no_price: number
  /** Variantes de productos activos evaluadas (con o sin precio base). */
  total_active_variants: number
}
