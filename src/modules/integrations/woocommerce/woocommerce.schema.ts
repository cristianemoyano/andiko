import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'

const quantityString = z.string().regex(/^\d+(\.\d{1,4})?$/, 'Cantidad inválida (máx. 4 decimales)')

export const woocommerceSiteSchema = z.object({
  name:                z.string().min(1).max(255),
  branch_id:           z.string().uuid(),
  store_url:           z.string().url().max(500),
  consumer_key:        z.string().min(1),
  consumer_secret:     z.string().min(1),
  webhook_secret:      z.string().min(1).nullable().optional(),
  price_list_id:       z.string().uuid().nullable().optional(),
  default_contact_id:  z.string().uuid().nullable().optional(),
  auto_publish:        z.boolean().default(false),
  stock_safety_buffer: quantityString.default('0'),
  is_active:           z.boolean().default(true),
})

// On update, secrets are optional — omit to keep the stored values.
export const woocommerceSiteUpdateSchema = woocommerceSiteSchema
  .partial()
  .extend({
    consumer_key:    z.string().min(1).optional(),
    consumer_secret: z.string().min(1).optional(),
  })

export const woocommerceSiteQuerySchema = paginationSchema.extend({
  search:    z.string().optional(),
  branch_id: z.string().uuid().optional(),
  is_active: z.coerce.boolean().optional(),
})

export const woocommerceImportApplySchema = z.object({
  // Products
  import_unmatched_products: z.boolean().default(true),
  // Orders backfill
  import_orders:             z.boolean().default(true),
  orders_since:              z.string().datetime().nullable().optional(),
  open_orders_only:          z.boolean().default(true),
  // Initial stock baseline
  stock_baseline:            z.enum(['push_erp', 'seed_from_woo', 'none']).default('none'),
})

export const woocommerceImportPreviewSchema = paginationSchema.extend({
  section: z.enum(['matched', 'to_import', 'needs_mapping']).default('needs_mapping'),
  refresh: z.boolean().default(false),
})

export const woocommercePublishSchema = z.object({
  action: z.enum(['start', 'tick', 'cancel']).default('start'),
  limit: z.number().int().positive().max(50).default(15).optional(),
})

export const woocommerceOrderImportPreviewSchema = paginationSchema.extend({
  open_orders_only: z.boolean().default(true),
  orders_since: z.string().datetime().nullable().optional(),
  section: z.enum(['to_import', 'already_imported', 'skipped']).default('to_import'),
  refresh: z.boolean().default(false),
})

export const woocommerceCustomerImportPreviewSchema = paginationSchema.extend({
  section: z.enum(['to_import', 'matched_by_email', 'already_linked', 'skipped']).default('to_import'),
  refresh: z.boolean().default(false),
})

export const woocommerceImportRunScopeSchema = z.enum(['products', 'orders', 'customers'])

export const woocommerceImportRunSchema = z.object({
  action: z.enum(['start', 'tick', 'cancel']).default('start'),
  scope: woocommerceImportRunScopeSchema.optional(),
  limit: z.number().int().positive().max(50).optional(),
  import_unmatched_products: z.boolean().default(true).optional(),
  open_orders_only: z.boolean().default(true).optional(),
  orders_since: z.string().datetime().nullable().optional(),
  stock_baseline: z.enum(['push_erp', 'seed_from_woo', 'none']).default('none').optional(),
})

export type WoocommerceSiteInput = z.infer<typeof woocommerceSiteSchema>
export type WoocommerceSiteUpdateInput = z.infer<typeof woocommerceSiteUpdateSchema>
export type WoocommerceSiteQuery = z.infer<typeof woocommerceSiteQuerySchema>
export type WoocommerceImportApplyInput = z.infer<typeof woocommerceImportApplySchema>
export type WoocommerceImportPreviewInput = z.infer<typeof woocommerceImportPreviewSchema>
export type WoocommercePublishInput = z.infer<typeof woocommercePublishSchema>
export type WoocommerceOrderImportPreviewInput = z.infer<typeof woocommerceOrderImportPreviewSchema>
export type WoocommerceCustomerImportPreviewInput = z.infer<typeof woocommerceCustomerImportPreviewSchema>
export type WoocommerceImportRunScope = z.infer<typeof woocommerceImportRunScopeSchema>
export type WoocommerceImportRunInput = z.infer<typeof woocommerceImportRunSchema>
