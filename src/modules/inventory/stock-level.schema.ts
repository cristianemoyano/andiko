import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'

function optionalQueryBoolean() {
  return z.preprocess((val: unknown) => {
    if (val === undefined || val === null || val === '') return undefined
    return val === 'true' || val === true
  }, z.boolean().optional())
}

export const stockLevelQuerySchema = paginationSchema.extend({
  warehouse_id: z.string().uuid().optional(),
  variant_id:   z.string().uuid().optional(),
  search:       z.string().optional(),
  below_minimum: optionalQueryBoolean(),
  expired:       optionalQueryBoolean(),
  /** Incluye filas con `expires_on` entre hoy y hoy+N (inclusive), solo si hay fecha de vencimiento. */
  expiring_within_days: z.coerce.number().int().min(1).max(366).optional(),
})

export type StockLevelQuery = z.infer<typeof stockLevelQuerySchema>

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')

export const stockItemAlertsPatchSchema = z.object({
  variant_id:         z.string().uuid(),
  warehouse_id:       z.string().uuid(),
  minimum_quantity:   z.coerce.number().min(0),
  /** `null` limpia el vencimiento. */
  expires_on:         z.union([isoDate, z.null()]),
})

export type StockItemAlertsPatchInput = z.infer<typeof stockItemAlertsPatchSchema>

export const bulkStockMinimumSchema = z.object({
  items: z.array(z.object({
    variant_id:   z.string().uuid(),
    warehouse_id: z.string().uuid(),
  })).min(1).max(100),
  minimum_quantity: z.coerce.number().min(0),
})

export type BulkStockMinimumInput = z.infer<typeof bulkStockMinimumSchema>

export const bulkStockExpirySchema = z.object({
  items: z.array(z.object({
    variant_id:   z.string().uuid(),
    warehouse_id: z.string().uuid(),
  })).min(1).max(100),
  /** `null` limpia el vencimiento en el lote default de cada ítem. */
  expires_on: z.union([isoDate, z.null()]),
})

export type BulkStockExpiryInput = z.infer<typeof bulkStockExpirySchema>

export const applyWarehouseDefaultMinimumSchema = z.object({
  /** Si true, solo actualiza filas con mínimo en 0. Si false, sobrescribe todos. */
  only_without_minimum: z.boolean().optional().default(true),
})

export type ApplyWarehouseDefaultMinimumInput = z.infer<typeof applyWarehouseDefaultMinimumSchema>
