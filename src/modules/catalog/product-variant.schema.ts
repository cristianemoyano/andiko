import { z } from 'zod'

export const productVariantSchema = z.object({
  product_id:     z.string().uuid(),
  sku:            z.string().min(1).max(100),
  name:           z.string().max(255).nullable().optional(),
  barcode:        z.string().max(100).nullable().optional(),
  cost_price:     z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  base_price:     z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  manage_stock:   z.boolean().optional(),
  allow_backorder: z.boolean().optional(),
  stock_quantity: z.coerce.number().int().min(0).optional(),
  is_default:     z.boolean().optional(),
  weight_kg:      z.string().regex(/^\d+(\.\d{1,3})?$/).nullable().optional(),
  length_cm:      z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  width_cm:       z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  height_cm:      z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  units_per_package: z.coerce.number().int().min(1).nullable().optional(),
})

export const productVariantUpdateSchema = productVariantSchema
  .omit({ product_id: true })
  .partial()

export type ProductVariantInput = z.infer<typeof productVariantSchema>
export type ProductVariantUpdateInput = z.infer<typeof productVariantUpdateSchema>

