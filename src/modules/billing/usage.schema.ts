import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'

const quantityString = z.string().regex(/^\d+(\.\d{1,4})?$/, 'Cantidad inválida (máx. 4 decimales)')

export const usageRecordSchema = z.object({
  org_id:          z.string().uuid(),
  subscription_id: z.string().uuid().nullable().optional(),
  metric_key:      z.string().min(1).max(50),
  quantity:        quantityString,
  period:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato: YYYY-MM-DD'),
})

export const usageQuerySchema = paginationSchema.extend({
  org_id:          z.string().uuid().optional(),
  subscription_id: z.string().uuid().optional(),
  metric_key:      z.string().optional(),
})

export type UsageRecordInput = z.infer<typeof usageRecordSchema>
export type UsageQuery = z.infer<typeof usageQuerySchema>
