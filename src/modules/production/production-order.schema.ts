import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import { PRODUCTION_ORDER_STATUSES } from './production.constants'

export const productionOrderSchema = z.object({
  branch_id:        z.string().uuid(),
  warehouse_id:     z.string().uuid().nullable().optional(),
  variant_id:       z.string().uuid().optional(),
  bom_id:           z.string().uuid().optional(),
  planned_quantity: z.coerce.number().positive(),
  scheduled_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD').nullable().optional(),
  notes:            z.string().nullable().optional(),
}).refine(v => !!v.variant_id || !!v.bom_id, {
  message: 'Debe indicar variant_id o bom_id',
  path: ['variant_id'],
})

export const productionOrderUpdateSchema = z.object({
  branch_id:        z.string().uuid().optional(),
  warehouse_id:     z.string().uuid().nullable().optional(),
  planned_quantity: z.coerce.number().positive().optional(),
  scheduled_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD').nullable().optional(),
  notes:            z.string().nullable().optional(),
})

export const productionOrderQuerySchema = paginationSchema.extend({
  search:     z.string().optional(),
  status:     z.enum(PRODUCTION_ORDER_STATUSES).optional(),
  branch_id:  z.string().uuid().optional(),
  variant_id: z.string().uuid().optional(),
})

export const completeProductionOrderSchema = z.object({
  produced_quantity: z.coerce.number().positive().nullable().optional(),
})

export type ProductionOrderInput          = z.infer<typeof productionOrderSchema>
export type ProductionOrderUpdateInput    = z.infer<typeof productionOrderUpdateSchema>
export type ProductionOrderQuery          = z.infer<typeof productionOrderQuerySchema>
export type CompleteProductionOrderInput  = z.infer<typeof completeProductionOrderSchema>
