import { z } from 'zod'

export const expensesReportQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  branch_id: z.string().uuid().optional(),
})

export type ExpensesReportQuery = z.infer<typeof expensesReportQuerySchema>
