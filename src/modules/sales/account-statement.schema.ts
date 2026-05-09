import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'

export const ACCOUNT_STATEMENT_MOVEMENT_TYPES = ['invoice', 'payment', 'credit_note'] as const
export type AccountStatementMovementType = (typeof ACCOUNT_STATEMENT_MOVEMENT_TYPES)[number]

export const accountStatementQuerySchema = paginationSchema.extend({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  search: z.string().optional(),
  movement_type: z.enum(ACCOUNT_STATEMENT_MOVEMENT_TYPES).optional(),
  summary_only: z.coerce.boolean().optional().default(false),
}).superRefine((value, ctx) => {
  if (value.from && value.to && value.from > value.to) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'from must be <= to',
      path: ['from'],
    })
  }
})

export type AccountStatementQuery = z.infer<typeof accountStatementQuerySchema>
