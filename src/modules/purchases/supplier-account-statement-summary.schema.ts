import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'

function queryBoolean(defaultValue: boolean) {
  return z.preprocess((val: unknown) => {
    if (val === undefined || val === null || val === '') return undefined
    return val === 'true' || val === true
  }, z.boolean().optional().default(defaultValue))
}

/** Listado global de cuentas corrientes de proveedores (resumen por proveedor). */
export const supplierAccountStatementSummaryListQuerySchema = paginationSchema.extend({
  /** Busca por razón social, nombre de fantasía o CUIT. */
  search: z.string().optional(),
  /** Por defecto solo proveedores con saldo pendiente. */
  only_with_balance: queryBoolean(true),
})

export type SupplierAccountStatementSummaryListQuery = z.infer<typeof supplierAccountStatementSummaryListQuerySchema>

/** Reporte de antigüedad de saldos (aging) de cuentas por pagar, a hoy. */
export const payablesAgingQuerySchema = paginationSchema.extend({
  /** Busca por razón social, nombre de fantasía o CUIT. */
  search: z.string().optional(),
  branch_id: z.string().uuid().optional(),
})

export type PayablesAgingQuery = z.infer<typeof payablesAgingQuerySchema>
