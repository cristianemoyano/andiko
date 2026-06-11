import { z } from 'zod'

export const PURCHASES_REPORT_GROUP_BYS = ['period', 'supplier', 'category'] as const
export type PurchasesReportGroupBy = typeof PURCHASES_REPORT_GROUP_BYS[number]

export const PURCHASES_REPORT_GRANULARITIES = ['day', 'week', 'month'] as const
export type PurchasesReportGranularity = typeof PURCHASES_REPORT_GRANULARITIES[number]

export const purchasesReportQuerySchema = z.object({
  group_by:    z.enum(PURCHASES_REPORT_GROUP_BYS).default('period'),
  granularity: z.enum(PURCHASES_REPORT_GRANULARITIES).default('month'),
  from:        z.coerce.date().optional(),
  to:          z.coerce.date().optional(),
  branch_id:   z.string().uuid().optional(),
})

export type PurchasesReportQuery = z.infer<typeof purchasesReportQuerySchema>
