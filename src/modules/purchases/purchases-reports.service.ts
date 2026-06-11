import 'server-only'
import { QueryTypes } from 'sequelize'
import Decimal from 'decimal.js'
import sequelize from '@/lib/db'
import { TenancyError, TENANCY_ERROR_CODES, type TenantContext } from '@/lib/tenancy'
import type {
  PurchasesReportGranularity,
  PurchasesReportGroupBy,
  PurchasesReportQuery,
} from './purchases-reports.schema'

/** Hard cap on the number of groups returned by any report query. */
const MAX_GROUPS = 500

/** Supplier invoices in these statuses are excluded from every purchases report. */
const EXCLUDED_INVOICE_STATUSES = ['draft', 'cancelled'] as const

export type PurchasesReportRow = {
  key: string
  label: string
  count: number
  subtotal: string
  tax_amount: string
  total: string
}

export type PurchasesReportTotals = {
  count: number
  subtotal: string
  tax_amount: string
  total: string
}

export type PurchasesReportResult = {
  group_by: PurchasesReportGroupBy
  granularity: PurchasesReportGranularity
  rows: PurchasesReportRow[]
  totals: PurchasesReportTotals
}

type RawReportRow = {
  key: string | null
  label: string | null
  count: string | null
  subtotal: string | null
  tax_amount: string | null
  total: string | null
}

/** Label format per granularity (es-AR conventions). */
const PERIOD_LABEL_FORMAT: Record<PurchasesReportGranularity, string> = {
  day:   'DD/MM/YYYY',
  week:  'DD/MM/YYYY',
  month: 'MM/YYYY',
}

function atStartOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function atEndOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

/**
 * Builds the tenant + date scope for the `supplier_invoices si` alias using
 * bound parameters only. Branch scoping mirrors `whereAllowedBranches`:
 * an empty `allowedBranchIds` (sys-admin) means no branch restriction.
 */
function buildScope(query: PurchasesReportQuery, ctx: TenantContext): {
  whereSql: string
  replacements: Record<string, unknown>
} {
  const clauses: string[] = [
    'si.org_id = :orgId',
    'si.deleted_at IS NULL',
    'si.status NOT IN (:excludedStatuses)',
  ]
  const replacements: Record<string, unknown> = {
    orgId: ctx.orgId,
    excludedStatuses: [...EXCLUDED_INVOICE_STATUSES],
  }

  if (query.branch_id) {
    if (ctx.allowedBranchIds.length > 0 && !ctx.allowedBranchIds.includes(query.branch_id)) {
      throw new TenancyError(TENANCY_ERROR_CODES.BRANCH_NOT_ALLOWED)
    }
    clauses.push('si.branch_id = :branchId')
    replacements.branchId = query.branch_id
  } else if (ctx.allowedBranchIds.length > 0) {
    clauses.push('si.branch_id IN (:allowedBranchIds)')
    replacements.allowedBranchIds = ctx.allowedBranchIds
  }

  if (query.from) {
    clauses.push('COALESCE(si.invoice_date, si.created_at) >= :fromDate')
    replacements.fromDate = atStartOfDay(query.from)
  }
  if (query.to) {
    clauses.push('COALESCE(si.invoice_date, si.created_at) <= :toDate')
    replacements.toDate = atEndOfDay(query.to)
  }

  return { whereSql: clauses.join(' AND '), replacements }
}

function periodSql(whereSql: string, granularity: PurchasesReportGranularity): string {
  // `granularity` is validated by the Zod enum ('day' | 'week' | 'month') — safe to interpolate.
  const bucket = `DATE_TRUNC('${granularity}', COALESCE(si.invoice_date, si.created_at))`
  return `
    SELECT
      TO_CHAR(${bucket}, 'YYYY-MM-DD')                          AS key,
      TO_CHAR(${bucket}, '${PERIOD_LABEL_FORMAT[granularity]}') AS label,
      COUNT(*)::text                                            AS count,
      COALESCE(SUM(CAST(si.subtotal   AS NUMERIC)), 0)::text    AS subtotal,
      COALESCE(SUM(CAST(si.tax_amount AS NUMERIC)), 0)::text    AS tax_amount,
      COALESCE(SUM(CAST(si.total      AS NUMERIC)), 0)::text    AS total
    FROM supplier_invoices si
    WHERE ${whereSql}
    GROUP BY 1, 2
    ORDER BY 1 ASC
    LIMIT ${MAX_GROUPS}
  `
}

function supplierSql(whereSql: string): string {
  return `
    SELECT
      COALESCE(c.id::text, 'sin-proveedor')                                        AS key,
      COALESCE(NULLIF(TRIM(c.trade_name), ''), c.legal_name, 'Sin proveedor')      AS label,
      COUNT(*)::text                                                               AS count,
      COALESCE(SUM(CAST(si.subtotal   AS NUMERIC)), 0)::text                       AS subtotal,
      COALESCE(SUM(CAST(si.tax_amount AS NUMERIC)), 0)::text                       AS tax_amount,
      COALESCE(SUM(CAST(si.total      AS NUMERIC)), 0)::text                       AS total
    FROM supplier_invoices si
    LEFT JOIN contacts c ON c.id = si.contact_id AND c.deleted_at IS NULL
    WHERE ${whereSql}
    GROUP BY 1, 2
    ORDER BY SUM(CAST(si.total AS NUMERIC)) DESC
    LIMIT ${MAX_GROUPS}
  `
}

function categorySql(whereSql: string): string {
  return `
    SELECT
      COALESCE(pc.id::text, 'sin-categoria')                    AS key,
      COALESCE(pc.name, 'Sin categoría')                        AS label,
      COUNT(DISTINCT si.id)::text                               AS count,
      COALESCE(SUM(CAST(sii.subtotal   AS NUMERIC)), 0)::text   AS subtotal,
      COALESCE(SUM(CAST(sii.tax_amount AS NUMERIC)), 0)::text   AS tax_amount,
      COALESCE(SUM(CAST(sii.total      AS NUMERIC)), 0)::text   AS total
    FROM supplier_invoices si
    JOIN supplier_invoice_items sii ON sii.invoice_id = si.id AND sii.deleted_at IS NULL
    LEFT JOIN products p            ON p.id  = sii.product_id  AND p.deleted_at  IS NULL
    LEFT JOIN product_categories pc ON pc.id = p.category_id   AND pc.deleted_at IS NULL
    WHERE ${whereSql}
    GROUP BY 1, 2
    ORDER BY SUM(CAST(sii.total AS NUMERIC)) DESC
    LIMIT ${MAX_GROUPS}
  `
}

function parseDecimal(value: unknown): Decimal {
  return new Decimal(String(value ?? '0'))
}

/**
 * Purchases report grouped by period / supplier / product category.
 * Source: supplier invoices excluding `draft` and `cancelled` (effective
 * date = `invoice_date`, falling back to `created_at` when not set).
 * Category grouping joins supplier_invoice_items → products → product_categories;
 * lines without a product (or with an uncategorized product) fall into "Sin categoría".
 */
export async function getPurchasesReport(
  query: PurchasesReportQuery,
  ctx: TenantContext,
): Promise<PurchasesReportResult> {
  const { whereSql, replacements } = buildScope(query, ctx)

  const sql =
    query.group_by === 'period'   ? periodSql(whereSql, query.granularity) :
    query.group_by === 'supplier' ? supplierSql(whereSql) :
    categorySql(whereSql)

  const rawRows = await sequelize.query<RawReportRow>(sql, {
    replacements,
    type: QueryTypes.SELECT,
  })

  let totalCount = 0
  let totalSubtotal = new Decimal(0)
  let totalTax = new Decimal(0)
  let totalTotal = new Decimal(0)

  const rows: PurchasesReportRow[] = rawRows.map((raw) => {
    const count = parseInt(raw.count ?? '0', 10)
    const subtotal = parseDecimal(raw.subtotal)
    const tax = parseDecimal(raw.tax_amount)
    const total = parseDecimal(raw.total)

    totalCount += count
    totalSubtotal = totalSubtotal.plus(subtotal)
    totalTax = totalTax.plus(tax)
    totalTotal = totalTotal.plus(total)

    return {
      key: raw.key ?? '',
      label: raw.label ?? '—',
      count,
      subtotal: subtotal.toFixed(2),
      tax_amount: tax.toFixed(2),
      total: total.toFixed(2),
    }
  })

  return {
    group_by: query.group_by,
    granularity: query.granularity,
    rows,
    totals: {
      count: totalCount,
      subtotal: totalSubtotal.toFixed(2),
      tax_amount: totalTax.toFixed(2),
      total: totalTotal.toFixed(2),
    },
  }
}
