import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import { IVA_RATES, type IvaRate } from '@/types'
import { EXPENSE_STATUSES, EXPENSE_KINDS } from './expense.model'
import { EXPENSE_SCHEDULE_FREQUENCIES } from './expense-schedule.model'

const ivaRateEnum = z.enum([...IVA_RATES] as [IvaRate, ...IvaRate[]])
const frequencyEnum = z.enum(EXPENSE_SCHEDULE_FREQUENCIES)

const commonCreateFields = {
  branch_id:            z.string().uuid(),
  contact_id:           z.string().uuid(),
  description:          z.string().min(1).max(500),
  expense_account_code: z.string().min(1).max(20),
  currency:             z.string().length(3).default('ARS'),
  iva_rate:             ivaRateEnum.default('21'),
  notes:                z.string().nullable().optional(),
}

/** One-off payable expense (existing behavior). */
const oneOffSchema = z.object({
  kind: z.literal('one_off'),
  ...commonCreateFields,
  invoice_number:  z.string().max(50).nullable().optional(),
  invoice_date:    z.string().datetime({ offset: true }).transform(s => new Date(s)),
  due_date:        z.string().datetime({ offset: true }).transform(s => new Date(s)),
  subtotal:        z.coerce.number().min(0),
  discount_amount: z.coerce.number().min(0).default(0),
})

/** Indefinite recurring series — creates schedule + first occurrence. */
const recurringSchema = z.object({
  kind: z.literal('recurring'),
  ...commonCreateFields,
  default_amount: z.coerce.number().positive(),
  frequency:      frequencyEnum.default('monthly'),
  next_run_date:  z.string().datetime({ offset: true }).transform(s => new Date(s)),
  is_active:      z.boolean().default(true),
})

/**
 * Installment plan — one expense for the full total + N cuota rows.
 * Provide either `installment_amount`×N or `total` (split evenly; last cuota adjusted).
 */
const installmentPlanSchema = z.object({
  kind: z.literal('installment_plan'),
  ...commonCreateFields,
  invoice_number:        z.string().max(50).nullable().optional(),
  invoice_date:          z.string().datetime({ offset: true }).transform(s => new Date(s)).optional(),
  installment_count:     z.coerce.number().int().min(2).max(360),
  first_due_date:        z.string().datetime({ offset: true }).transform(s => new Date(s)),
  installment_frequency: frequencyEnum.default('monthly'),
  installment_amount:    z.coerce.number().positive().optional(),
  total:                 z.coerce.number().positive().optional(),
  discount_amount:       z.coerce.number().min(0).default(0),
}).superRefine((val, ctx) => {
  if (val.installment_amount == null && val.total == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Indicá monto de cuota o total del plan',
      path: ['installment_amount'],
    })
  }
})

const expenseCreateUnion = z.discriminatedUnion('kind', [
  oneOffSchema,
  recurringSchema,
  installmentPlanSchema,
])

/** Accepts create payloads; omitted `kind` defaults to `one_off`. */
export const expenseCreateSchema = z.preprocess((raw) => {
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && !('kind' in (raw as object))) {
    return { ...(raw as Record<string, unknown>), kind: 'one_off' }
  }
  return raw
}, expenseCreateUnion)

/** Legacy one-off-only schema (still accepted via expenseCreateSchema default). */
export const expenseSchema = oneOffSchema

export const expenseUpdateSchema = z.object({
  branch_id:            z.string().uuid().optional(),
  contact_id:           z.string().uuid().optional(),
  description:          z.string().min(1).max(500).optional(),
  expense_account_code: z.string().min(1).max(20).optional(),
  invoice_number:       z.string().max(50).nullable().optional(),
  invoice_date:         z.string().datetime({ offset: true }).transform(s => new Date(s)).optional(),
  due_date:             z.string().datetime({ offset: true }).transform(s => new Date(s)).optional(),
  currency:             z.string().length(3).optional(),
  subtotal:             z.coerce.number().min(0).optional(),
  discount_amount:      z.coerce.number().min(0).optional(),
  iva_rate:             ivaRateEnum.optional(),
  notes:                z.string().nullable().optional(),
})

export const expenseQuerySchema = paginationSchema.extend({
  search:     z.string().optional(),
  status:     z.enum(EXPENSE_STATUSES).optional(),
  kind:       z.enum(EXPENSE_KINDS).optional(),
  contact_id: z.string().uuid().optional(),
  overdue:    z.coerce.boolean().optional(),
})

export type ExpenseCreateInput = z.infer<typeof expenseCreateUnion>
export type ExpenseInput       = z.infer<typeof expenseSchema>
export type ExpenseUpdateInput = z.infer<typeof expenseUpdateSchema>
export type ExpenseQuery       = z.infer<typeof expenseQuerySchema>
