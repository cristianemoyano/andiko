import 'server-only'
import { QueryTypes } from 'sequelize'
import Decimal from 'decimal.js'
import sequelize from '@/lib/db'
import { paginate, toPaginated } from '@/lib/pagination'
import { TenancyError, TENANCY_ERROR_CODES, type TenantContext } from '@/lib/tenancy'
import { OPEN_PAYABLE_EXPENSE_STATUSES } from './expense.constants'
import type { ExpensesPayablesAgingQuery } from './expenses-aging.schema'

export type ExpensesPayablesAgingRow = {
  contact_id: string
  legal_name: string
  trade_name: string | null
  cuit: string | null
  invoices_count: number
  current: string
  bucket_1_30: string
  bucket_31_60: string
  bucket_61_90: string
  bucket_90_plus: string
  balance: string
}

export type ExpensesPayablesAgingTotals = Omit<
  ExpensesPayablesAgingRow,
  'contact_id' | 'legal_name' | 'trade_name' | 'cuit'
>

type RawAgingRow = {
  contact_id: string
  legal_name: string
  trade_name: string | null
  cuit: string | null
  invoices_count: number
  current: string
  bucket_1_30: string
  bucket_31_60: string
  bucket_61_90: string
  bucket_90_plus: string
  balance: string
}

type RawTotalsRow = {
  invoices_count: number
  current: string
  bucket_1_30: string
  bucket_31_60: string
  bucket_61_90: string
  bucket_90_plus: string
  balance: string
}

type CountRow = { count: string }

const ZERO_TOTALS: ExpensesPayablesAgingTotals = {
  invoices_count: 0,
  current: '0.00',
  bucket_1_30: '0.00',
  bucket_31_60: '0.00',
  bucket_61_90: '0.00',
  bucket_90_plus: '0.00',
  balance: '0.00',
}

/** Per-expense bucket expressions, applied only to open balances (`e.balance > 0`). */
const BUCKET_COLUMNS = `
    COUNT(e.id)::int AS invoices_count,
    COALESCE(SUM(CASE WHEN CAST(e.balance AS NUMERIC) > 0
      AND (e.due_date IS NULL OR e.due_date >= NOW())
      THEN CAST(e.balance AS NUMERIC) ELSE 0 END), 0)::text AS current,
    COALESCE(SUM(CASE WHEN CAST(e.balance AS NUMERIC) > 0 AND e.due_date < NOW()
      AND EXTRACT(DAY FROM NOW() - e.due_date) BETWEEN 0 AND 30
      THEN CAST(e.balance AS NUMERIC) ELSE 0 END), 0)::text AS bucket_1_30,
    COALESCE(SUM(CASE WHEN CAST(e.balance AS NUMERIC) > 0 AND e.due_date < NOW()
      AND EXTRACT(DAY FROM NOW() - e.due_date) BETWEEN 31 AND 60
      THEN CAST(e.balance AS NUMERIC) ELSE 0 END), 0)::text AS bucket_31_60,
    COALESCE(SUM(CASE WHEN CAST(e.balance AS NUMERIC) > 0 AND e.due_date < NOW()
      AND EXTRACT(DAY FROM NOW() - e.due_date) BETWEEN 61 AND 90
      THEN CAST(e.balance AS NUMERIC) ELSE 0 END), 0)::text AS bucket_61_90,
    COALESCE(SUM(CASE WHEN CAST(e.balance AS NUMERIC) > 0 AND e.due_date < NOW()
      AND EXTRACT(DAY FROM NOW() - e.due_date) > 90
      THEN CAST(e.balance AS NUMERIC) ELSE 0 END), 0)::text AS bucket_90_plus,
    COALESCE(SUM(CAST(e.balance AS NUMERIC)), 0)::text AS balance
`

function mapRow(row: RawAgingRow): ExpensesPayablesAgingRow {
  return {
    contact_id: String(row.contact_id),
    legal_name: String(row.legal_name),
    trade_name: row.trade_name ? String(row.trade_name) : null,
    cuit: row.cuit ? String(row.cuit) : null,
    invoices_count: Number(row.invoices_count ?? 0),
    current: new Decimal(String(row.current ?? '0')).toFixed(2),
    bucket_1_30: new Decimal(String(row.bucket_1_30 ?? '0')).toFixed(2),
    bucket_31_60: new Decimal(String(row.bucket_31_60 ?? '0')).toFixed(2),
    bucket_61_90: new Decimal(String(row.bucket_61_90 ?? '0')).toFixed(2),
    bucket_90_plus: new Decimal(String(row.bucket_90_plus ?? '0')).toFixed(2),
    balance: new Decimal(String(row.balance ?? '0')).toFixed(2),
  }
}

function mapTotals(row: RawTotalsRow | undefined): ExpensesPayablesAgingTotals {
  if (!row) return ZERO_TOTALS
  return {
    invoices_count: Number(row.invoices_count ?? 0),
    current: new Decimal(String(row.current ?? '0')).toFixed(2),
    bucket_1_30: new Decimal(String(row.bucket_1_30 ?? '0')).toFixed(2),
    bucket_31_60: new Decimal(String(row.bucket_31_60 ?? '0')).toFixed(2),
    bucket_61_90: new Decimal(String(row.bucket_61_90 ?? '0')).toFixed(2),
    bucket_90_plus: new Decimal(String(row.bucket_90_plus ?? '0')).toFixed(2),
    balance: new Decimal(String(row.balance ?? '0')).toFixed(2),
  }
}

/**
 * Reporte de antigüedad de saldos (aging) de gastos de expensas: para cada proveedor
 * con saldo pendiente, desglosa cuánto cae en cada bucket de días de atraso sobre
 * `due_date` (a hoy: `current`, `1_30`, `31_60`, `61_90`, `90_plus`), sobre gastos
 * confirmados o parcialmente pagados (org/branch scoped). Solo proveedores con saldo > 0.
 * Los gastos sin proveedor asignado (`contact_id IS NULL`) quedan excluidos.
 */
export async function getExpensesPayablesAging(query: ExpensesPayablesAgingQuery, ctx: TenantContext) {
  const { offset, limit } = paginate(query.page, query.limit)
  const search = query.search?.trim() ?? ''

  if (query.branch_id && ctx.allowedBranchIds.length > 0 && !ctx.allowedBranchIds.includes(query.branch_id)) {
    throw new TenancyError(TENANCY_ERROR_CODES.BRANCH_NOT_ALLOWED)
  }

  const branchClause = query.branch_id
    ? 'AND e.branch_id = :branchId'
    : ctx.allowedBranchIds.length > 0
      ? 'AND e.branch_id IN (:branchIds)'
      : ''
  const searchClause = search
    ? 'AND (c.legal_name ILIKE :search OR c.trade_name ILIKE :search OR c.cuit ILIKE :search)'
    : ''

  const baseWhereClause = `
    WHERE e.org_id = :orgId
      AND e.deleted_at IS NULL
      AND e.status IN (:openStatuses)
      AND e.contact_id IS NOT NULL
      ${branchClause}
      ${searchClause}
  `

  const groupedFromClause = `
    FROM expenses e
    JOIN contacts c ON c.id = e.contact_id AND c.deleted_at IS NULL
    ${baseWhereClause}
    GROUP BY c.id, c.legal_name, c.trade_name, c.cuit
    HAVING COALESCE(SUM(CAST(e.balance AS NUMERIC)), 0) > 0
  `

  const replacements: Record<string, unknown> = {
    orgId: ctx.orgId,
    openStatuses: [...OPEN_PAYABLE_EXPENSE_STATUSES],
  }
  if (query.branch_id) replacements.branchId = query.branch_id
  else if (ctx.allowedBranchIds.length > 0) replacements.branchIds = ctx.allowedBranchIds
  if (search) replacements.search = `%${search}%`

  const rows = await sequelize.query<RawAgingRow>(`
    SELECT
      c.id AS contact_id,
      c.legal_name,
      c.trade_name,
      c.cuit,
      ${BUCKET_COLUMNS}
    ${groupedFromClause}
    ORDER BY COALESCE(SUM(CAST(e.balance AS NUMERIC)), 0) DESC, c.legal_name ASC
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

  // Totals across the entire filtered result set (not just the current page):
  // restrict to contacts with balance > 0 via a CTE, then aggregate their expenses in one shot.
  const [totalsRow] = await sequelize.query<RawTotalsRow>(`
    WITH contacts_with_balance AS (
      SELECT c.id ${groupedFromClause}
    )
    SELECT ${BUCKET_COLUMNS}
    FROM expenses e
    JOIN contacts c ON c.id = e.contact_id AND c.deleted_at IS NULL
    WHERE e.contact_id IN (SELECT id FROM contacts_with_balance)
      ${baseWhereClause.replace('WHERE', 'AND')}
  `, {
    replacements,
    type: QueryTypes.SELECT,
  })

  const data = rows.map(mapRow)
  const total = parseInt(countRow?.count ?? '0', 10)
  const totals = mapTotals(totalsRow)

  return { ...toPaginated(data, total, query.page, query.limit), totals }
}
