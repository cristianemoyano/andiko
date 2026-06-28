import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import { listSourceQuerySchema } from '@/modules/integrations/woocommerce/woo-list-filters'
import type { ProductStatus, ProductType, IvaRate, UnitOfMeasure } from './product.model'

const productStatusEnum   = z.enum(['draft', 'active', 'archived'] as const)
const productTypeEnum     = z.enum(['simple', 'service'] as const)
const ivaRateEnum         = z.enum(['0', '10.5', '21', '27'] as const)
const unitOfMeasureEnum   = z.enum(['unidad', 'kg', 'g', 'litro', 'ml', 'metro', 'cm', 'm2', 'm3', 'hora', 'caja', 'paquete', 'docena', 'par', 'rollo'] as const)

const productImageSchema = z.object({
  url:      z.string().max(2048),
  alt:      z.string().max(500).nullable().optional(),
  position: z.number().int().min(0),
})

const productBaseSchema = z.object({
  name:              z.string().min(1).max(255),
  category_id:       z.string().uuid().nullable().optional(),
  description:       z.string().nullable().optional(),
  short_description: z.string().max(500).nullable().optional(),
  product_type:      productTypeEnum.optional(),
  status:            productStatusEnum.optional(),
  vendor:            z.string().max(255).nullable().optional(),
  iva_rate:          ivaRateEnum.optional(),
  unit_of_measure:   unitOfMeasureEnum.optional(),
  ncm_code:          z.string().length(8).regex(/^\d{8}$/, 'NCM debe ser 8 dígitos').nullable().optional(),
  tags:              z.array(z.string().max(50)).max(20).optional(),
  images:            z.array(productImageSchema).max(20).optional(),
  // Variante default — requerida al crear
  sku:               z.string().min(1).max(100),
  barcode:           z.string().max(100).nullable().optional(),
  cost_price:        z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  base_price:        z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  manage_stock:      z.boolean().optional(),
  stock_quantity:    z.coerce.number().int().min(0).optional(),
  // Balanza / venta por peso
  sold_by_weight:    z.boolean().optional(),
  plu_code:          z.string().trim().max(20).regex(/^\d+$/, 'El PLU debe ser numérico').nullable().optional(),
})

/** Si se vende por peso, el PLU es obligatorio. */
const requirePluWhenSoldByWeight = (
  data: { sold_by_weight?: boolean; plu_code?: string | null },
  ctx: z.RefinementCtx,
) => {
  if (data.sold_by_weight && !data.plu_code) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['plu_code'],
      message: 'El código PLU es obligatorio para productos que se venden por peso',
    })
  }
}

export const productSchema = productBaseSchema.superRefine(requirePluWhenSoldByWeight)

export const productUpdateSchema = productBaseSchema
  .omit({ sku: true })
  .extend({
    sku:            z.string().min(1).max(100).optional(),
    stock_quantity: z.number().int().min(0).optional(),
    manage_stock:   z.boolean().optional(),
  })
  .partial()
  .superRefine(requirePluWhenSoldByWeight)

export const productQuerySchema = paginationSchema.extend({
  search:       z.string().optional(),
  category_id:  z.string().uuid().optional(),
  status:       productStatusEnum.optional(),
  product_type: productTypeEnum.optional(),
  source:       listSourceQuerySchema,
})

// suppress unused import warning — types used externally
export type { ProductStatus, ProductType, IvaRate, UnitOfMeasure }

export type ProductInput       = z.infer<typeof productSchema>
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>
export type ProductQuery       = z.infer<typeof productQuerySchema>
