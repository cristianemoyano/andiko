import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import { CREDIT_CARD_CURRENCY_MODES } from './credit-card.model'
import { CREDIT_CARD_STATEMENT_STATUSES } from './credit-card-statement.model'

export const creditCardSchema = z.object({
  branch_id:            z.string().uuid(),
  contact_id:           z.string().uuid(),
  name:                 z.string().min(1).max(120),
  last_four:            z.string().regex(/^\d{4}$/).nullable().optional(),
  currency_mode:        z.enum(CREDIT_CARD_CURRENCY_MODES).default('ars'),
  closing_day:          z.coerce.number().int().min(1).max(31),
  due_day:              z.coerce.number().int().min(1).max(31),
  expense_account_code: z.string().min(1).max(20),
  is_active:            z.boolean().default(true),
  notes:                z.string().nullable().optional(),
})

export const creditCardUpdateSchema = creditCardSchema.partial()

export const creditCardQuerySchema = paginationSchema.extend({
  search:    z.string().optional(),
  is_active: z.coerce.boolean().optional(),
})

export const creditCardStatementSchema = z.object({
  credit_card_id: z.string().uuid(),
  period_label:   z.string().min(1).max(40),
  closing_date:   z.string().datetime({ offset: true }).transform(s => new Date(s)),
  due_date:       z.string().datetime({ offset: true }).transform(s => new Date(s)),
  amount_ars:     z.coerce.number().min(0).default(0),
  amount_usd:     z.coerce.number().min(0).default(0),
  fx_rate:        z.coerce.number().positive().nullable().optional(),
  notes:          z.string().nullable().optional(),
}).superRefine((val, ctx) => {
  if (val.amount_ars <= 0 && val.amount_usd <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Indicá un monto en ARS y/o USD',
      path: ['amount_ars'],
    })
  }
  if (val.amount_usd > 0 && (val.fx_rate == null || val.fx_rate <= 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Indicá la cotización para convertir USD a ARS',
      path: ['fx_rate'],
    })
  }
})

/** Amount-only correction of an existing statement (period/dates stay fixed). */
export const creditCardStatementAmountsSchema = z.object({
  amount_ars: z.coerce.number().min(0).default(0),
  amount_usd: z.coerce.number().min(0).default(0),
  fx_rate:    z.coerce.number().positive().nullable().optional(),
}).superRefine((val, ctx) => {
  if (val.amount_ars <= 0 && val.amount_usd <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Indicá un monto en ARS y/o USD',
      path: ['amount_ars'],
    })
  }
  if (val.amount_usd > 0 && (val.fx_rate == null || val.fx_rate <= 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Indicá la cotización para convertir USD a ARS',
      path: ['fx_rate'],
    })
  }
})

export const creditCardStatementQuerySchema = paginationSchema.extend({
  credit_card_id: z.string().uuid().optional(),
  status:         z.enum(CREDIT_CARD_STATEMENT_STATUSES).optional(),
})

export type CreditCardInput = z.infer<typeof creditCardSchema>
export type CreditCardUpdateInput = z.infer<typeof creditCardUpdateSchema>
export type CreditCardQuery = z.infer<typeof creditCardQuerySchema>
export type CreditCardStatementInput = z.infer<typeof creditCardStatementSchema>
export type CreditCardStatementAmountsInput = z.infer<typeof creditCardStatementAmountsSchema>
export type CreditCardStatementQuery = z.infer<typeof creditCardStatementQuerySchema>
