import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'

export const bomItemSchema = z.object({
  component_variant_id: z.string().uuid(),
  quantity:              z.coerce.number().positive(),
  scrap_pct:             z.coerce.number().min(0).max(99.99).default(0),
  sort_order:            z.coerce.number().int().min(0).default(0),
  notes:                 z.string().nullable().optional(),
})

export const bomSchema = z.object({
  variant_id:      z.string().uuid(),
  name:            z.string().min(1).max(255),
  output_quantity: z.coerce.number().positive().default(1),
  notes:           z.string().nullable().optional(),
  items:           z.array(bomItemSchema).min(1),
})

export const bomReplaceSchema = z.object({
  name:            z.string().min(1).max(255).optional(),
  output_quantity: z.coerce.number().positive().optional(),
  notes:           z.string().nullable().optional(),
  items:           z.array(bomItemSchema).min(1),
})

export const bomQuerySchema = paginationSchema.extend({
  search:     z.string().optional(),
  variant_id: z.string().uuid().optional(),
  is_active:  z.coerce.boolean().optional(),
})

export type BomItemInput   = z.infer<typeof bomItemSchema>
export type BomInput       = z.infer<typeof bomSchema>
export type BomReplaceInput = z.infer<typeof bomReplaceSchema>
export type BomQuery       = z.infer<typeof bomQuerySchema>
