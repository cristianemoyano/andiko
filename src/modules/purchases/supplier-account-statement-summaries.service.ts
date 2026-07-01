import 'server-only'
import { QueryTypes } from 'sequelize'
import Decimal from 'decimal.js'
import sequelize from '@/lib/db'
import { paginate, toPaginated } from '@/lib/pagination'
import type { TenantContext } from '@/lib/tenancy'
import { OPEN_PAYABLE_INVOICE_STATUSES } from './supplier-invoice.constants'
import type { SupplierAccountStatementSummaryListQuery } from './supplier-account-statement-summary.schema'

export type SupplierAccountStatementSummaryRow = {
  contact_id: string
  legal_name: string
  trade_name: string | null
  cuit: string | null
  invoices_count: number
  total_invoiced: string
  total_paid: string
  balance: string
  overdue_balance: string
  debt_status: 'up_to_date' | 'with_balance' | 'overdue'
}

type RawSummaryRow = {
  contact_id: string
  legal_name: string
  trade_name: string | null
  cuit: string | null
  invoices_count: number
  total_invoiced: string
  total_paid: string
  balance: string
  overdue_balance: string
}

type CountRow = { count: string }

/**
 * Listado global de cuentas corrientes de proveedores: una fila por proveedor con
 * facturación, saldo y saldo vencido agregados sobre facturas recibidas o parcialmente pagadas
 */
export async function listSupplierAccountStatementSummaries(
  query: SupplierAccountStatementSummaryListQuery,
  ctx: TenantContext,
) {
  const { offset, limit } = paginate(query.page, query.limit)
  const search = query.search?.trim() ?? ''

  const branchClause = ctx.allowedBranchIds.length > 0 ? 'AND si.branch_id IN (:branchIds)' : ''
  const searchClause = search
    ? 'AND (c.legal_name ILIKE :search OR c.trade_name ILIKE :search OR c.cuit ILIKE :search)'
    : ''
  const havingClause = query.only_with_balance
    ? 'HAVING COALESCE(SUM(CAST(si.balance AS NUMERIC)), 0) > 0'
    : ''

  const groupedFromClause = `
    FROM supplier_invoices si
    JOIN contacts c ON c.id = si.contact_id AND c.deleted_at IS NULL
    WHERE si.org_id = :orgId
      AND si.deleted_at IS NULL
      AND si.status IN (:openStatuses)
      ${branchClause}
      ${searchClause}
    GROUP BY c.id, c.legal_name, c.trade_name, c.cuit
    ${havingClause}
  `

  const replacements: Record<string, unknown> = {
    orgId: ctx.orgId,
    openStatuses: [...OPEN_PAYABLE_INVOICE_STATUSES],
  }
  if (ctx.allowedBranchIds.length > 0) replacements.branchIds = ctx.allowedBranchIds
  if (search) replacements.search = `%${search}%`

  const rows = await sequelize.query<RawSummaryRow>(`
    SELECT
      c.id AS contact_id,
      c.legal_name,
      c.trade_name,
      c.cuit,
      COUNT(si.id)::int AS invoices_count,
      COALESCE(SUM(CAST(si.total AS NUMERIC)), 0)::text AS total_invoiced,
      COALESCE(SUM(CAST(si.paid_amount AS NUMERIC)), 0)::text AS total_paid,
      COALESCE(SUM(CAST(si.balance AS NUMERIC)), 0)::text AS balance,
      COALESCE(SUM(
        CASE WHEN si.due_date < NOW() AND CAST(si.balance AS NUMERIC) > 0
          THEN CAST(si.balance AS NUMERIC) ELSE 0 END
      ), 0)::text AS overdue_balance
    ${groupedFromClause}
    ORDER BY
      COALESCE(SUM(
        CASE WHEN si.due_date < NOW() AND CAST(si.balance AS NUMERIC) > 0
          THEN CAST(si.balance AS NUMERIC) ELSE 0 END
      ), 0) DESC,
      COALESCE(SUM(CAST(si.balance AS NUMERIC)), 0) DESC,
      c.legal_name ASC
    LIMIT :limit OFFSET :offset
  `, {
    replacements: { ...replacements, limit, offset },
    type: QueryTypes.SELECT,
  })

  const [countRow] = await sequelize.query<CountRow>(`
    SELECT COUNT(*)::text AS count
    FROM (SELECT c.id ${groupedFromClause}) grouped
  `, {
    replacements,
    type: QueryTypes.SELECT,
  })

  const data: SupplierAccountStatementSummaryRow[] = rows.map((row) => {
    const balance = new Decimal(String(row.balance ?? '0'))
    const overdue = new Decimal(String(row.overdue_balance ?? '0'))

    let debtStatus: SupplierAccountStatementSummaryRow['debt_status'] = 'up_to_date'
    if (overdue.gt(0)) debtStatus = 'overdue'
    else if (balance.gt(0)) debtStatus = 'with_balance'

    return {
      contact_id: String(row.contact_id),
      legal_name: String(row.legal_name),
      trade_name: row.trade_name ? String(row.trade_name) : null,
      cuit: row.cuit ? String(row.cuit) : null,
      invoices_count: Number(row.invoices_count ?? 0),
      total_invoiced: new Decimal(String(row.total_invoiced ?? '0')).toFixed(2),
      total_paid: new Decimal(String(row.total_paid ?? '0')).toFixed(2),
      balance: balance.toFixed(2),
      overdue_balance: overdue.toFixed(2),
      debt_status: debtStatus,
    }
  })

  const total = parseInt(countRow?.count ?? '0', 10)
  return toPaginated(data, total, query.page, query.limit)
}
