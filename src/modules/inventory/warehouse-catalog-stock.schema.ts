import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'

function optionalQueryBoolean() {
  return z.preprocess((val: unknown) => {
    if (val === undefined || val === null || val === '') return undefined
    return val === 'true' || val === true
  }, z.boolean().optional())
}

export const catalogStockCandidatesQuerySchema = paginationSchema.extend({
  search: z.string().max(100).optional(),
  /** Si true, solo variantes que aún no tienen fila de stock en este depósito. */
  only_not_in_warehouse: optionalQueryBoolean(),
})

export type CatalogStockCandidatesQuery = z.infer<typeof catalogStockCandidatesQuerySchema>

export const bulkLoadCatalogStockFromFilterSchema = z.object({
  quantity: z.coerce.number().min(0),
  search: z.string().max(100).optional(),
  only_not_in_warehouse: z.boolean().optional(),
  notes: z.string().max(500).nullable().optional(),
  stream: z.boolean().optional(),
})

export type BulkLoadCatalogStockFromFilterInput = z.infer<typeof bulkLoadCatalogStockFromFilterSchema>

export const loadCatalogStockBatchSchema = z.object({
  items: z.array(z.object({
    variant_id: z.string().uuid(),
    quantity:   z.coerce.number().min(0),
  })).min(1).max(100),
  notes: z.string().max(500).nullable().optional(),
})

export type LoadCatalogStockBatchInput = z.infer<typeof loadCatalogStockBatchSchema>
