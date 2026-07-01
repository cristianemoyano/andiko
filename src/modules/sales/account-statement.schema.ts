import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'

export const ACCOUNT_STATEMENT_MOVEMENT_TYPES = ['invoice', 'payment', 'credit_note', 'refund'] as const
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

function queryBoolean(defaultValue: boolean) {
  return z.preprocess((val: unknown) => {
    if (val === undefined || val === null || val === '') return undefined
    return val === 'true' || val === true
  }, z.boolean().optional().default(defaultValue))
}

/** Listado global de cuentas corrientes (resumen por cliente). */
export const accountStatementSummaryListQuerySchema = paginationSchema.extend({
  /** Busca por razón social, nombre de fantasía o CUIT. */
  search: z.string().optional(),
  /** Por defecto solo clientes con saldo pendiente. */
  only_with_balance: queryBoolean(true),
})

export type AccountStatementSummaryListQuery = z.infer<typeof accountStatementSummaryListQuerySchema>

/** Reporte de antigüedad de saldos (aging) de cuentas por cobrar, a hoy. */
export const receivablesAgingQuerySchema = paginationSchema.extend({
  /** Busca por razón social, nombre de fantasía o CUIT. */
  search: z.string().optional(),
  branch_id: z.string().uuid().optional(),
})

export type ReceivablesAgingQuery = z.infer<typeof receivablesAgingQuerySchema>
