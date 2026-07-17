import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'

/** Reporte de antigüedad de saldos (aging) de gastos de expensas por proveedor, a hoy. */
export const expensesPayablesAgingQuerySchema = paginationSchema.extend({
  /** Busca por razón social, nombre de fantasía o CUIT. */
  search: z.string().optional(),
  branch_id: z.string().uuid().optional(),
})

export type ExpensesPayablesAgingQuery = z.infer<typeof expensesPayablesAgingQuerySchema>
