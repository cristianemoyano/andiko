import { z } from 'zod'

export const SALES_REPORT_GROUP_BYS = ['period', 'customer', 'product'] as const
export type SalesReportGroupBy = (typeof SALES_REPORT_GROUP_BYS)[number]

export const SALES_REPORT_GRANULARITIES = ['day', 'week', 'month'] as const
export type SalesReportGranularity = (typeof SALES_REPORT_GRANULARITIES)[number]

export const salesReportQuerySchema = z.object({
  group_by: z.enum(SALES_REPORT_GROUP_BYS).default('period'),
  /** Solo aplica cuando `group_by === 'period'`. */
  granularity: z.enum(SALES_REPORT_GRANULARITIES).default('month'),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  branch_id: z.string().uuid().optional(),
}).superRefine((value, ctx) => {
  if (value.from && value.to && value.from > value.to) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'from must be <= to',
      path: ['from'],
    })
  }
})

export type SalesReportQuery = z.infer<typeof salesReportQuerySchema>
