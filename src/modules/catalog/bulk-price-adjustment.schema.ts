import { z } from 'zod'

export const bulkPriceAdjustmentSchema = z.object({
  /** Ajustar precio base de variantes o precio en lista */
  target: z.enum(['base_price', 'price_list']),
  /** Requerido cuando target = price_list */
  price_list_id: z.string().uuid().optional(),
  /** Filtrar por categoría; omitir = todas */
  category_id: z.string().uuid().optional(),
  adjustment_type: z.enum([
    'percent_increase',
    'percent_decrease',
    'fixed_increase',
    'fixed_decrease',
    'set',
  ]),
  /** Porcentaje (ej. 10 = 10%) o monto fijo ARS según adjustment_type */
  value: z.string().regex(/^\d+(\.\d{1,4})?$/),
  dry_run: z.boolean().optional().default(false),
}).superRefine((data, ctx) => {
  if (data.target === 'price_list' && !data.price_list_id) {
    ctx.addIssue({ code: 'custom', message: 'price_list_id es requerido para ajustes en lista de precios', path: ['price_list_id'] })
  }
})

export type BulkPriceAdjustmentInput = z.infer<typeof bulkPriceAdjustmentSchema>

export interface BulkPriceAdjustmentPreview {
  affected_count: number
  sample: Array<{ variant_id: string; sku: string; current_price: string; new_price: string }>
}

export interface BulkPriceAdjustmentResult extends BulkPriceAdjustmentPreview {
  updated_count: number
}
