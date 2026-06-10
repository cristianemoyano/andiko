import 'server-only'
import { QueryTypes } from 'sequelize'
import Decimal from 'decimal.js'
import sequelize from '@/lib/db'
import { TenancyError, TENANCY_ERROR_CODES, type TenantContext } from '@/lib/tenancy'
import type { SalesReportGranularity, SalesReportGroupBy, SalesReportQuery } from './sales-reports.schema'

/** Tope de grupos devueltos por reporte (lista siempre acotada). */
export const SALES_REPORT_GROUP_LIMIT = 500

/** Facturas que computan para reportes: emitidas/cobradas (sin borradores ni anuladas). */
const REPORT_STATUS_CLAUSE = "i.status IN ('issued', 'partially_paid', 'paid')"

/** Mapeo cerrado (no input del usuario) para interpolar en SQL de forma segura. */
const GRANULARITY_SQL: Record<SalesReportGranularity, { trunc: string; label: string }> = {
  day:   { trunc: 'day',   label: "TO_CHAR(p.period, 'DD/MM/YYYY')" },
  week:  { trunc: 'week',  label: "'Sem ' || TO_CHAR(p.period, 'DD/MM/YYYY')" },
  month: { trunc: 'month', label: "TO_CHAR(p.period, 'MM/YYYY')" },
}

export type SalesReportRow = {
  group_key: string
  label: string
  secondary_label: string | null
  documents: number
  /** Solo para `group_by === 'product'`. */
  quantity: string | null
  subtotal: string
  tax: string
  total: string
}

export type SalesReportTotals = {
  documents: number
  quantity: string | null
  subtotal: string
  tax: string
  total: string
}

export type SalesReportResult = {
  group_by: SalesReportGroupBy
  granularity: SalesReportGranularity
  data: SalesReportRow[]
  totals: SalesReportTotals
  truncated: boolean
}

type RawReportRow = {
  group_key: string
  label: string | null
  secondary_label: string | null
  documents: number
  quantity?: string | null
  subtotal: string
  tax: string
  total: string
}

type RawTotalsRow = {
  documents: number
  quantity?: string | null
  subtotal: string
  tax: string
  total: string
}

function resolveBranchIds(query: SalesReportQuery, ctx: TenantContext): string[] | null {
  if (query.branch_id) {
    if (ctx.allowedBranchIds.length > 0 && !ctx.allowedBranchIds.includes(query.branch_id)) {
      throw new TenancyError(TENANCY_ERROR_CODES.BRANCH_NOT_ALLOWED)
    }
    return [query.branch_id]
  }
  return ctx.allowedBranchIds.length > 0 ? ctx.allowedBranchIds : null
}

function atEndOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

function money(value: unknown): string {
  return new Decimal(String(value ?? '0')).toFixed(2)
}

export async function getSalesReport(query: SalesReportQuery, ctx: TenantContext): Promise<SalesReportResult> {
  const branchIds = resolveBranchIds(query, ctx)

  const branchClause = branchIds ? 'AND i.branch_id IN (:branchIds)' : ''
  const fromClause = query.from ? 'AND i.issue_date >= :from' : ''
  const toClause = query.to ? 'AND i.issue_date <= :to' : ''

  const replacements: Record<string, unknown> = {
    orgId: ctx.orgId,
    groupLimit: SALES_REPORT_GROUP_LIMIT,
  }
  if (branchIds) replacements.branchIds = branchIds
  if (query.from) replacements.from = query.from
  if (query.to) replacements.to = atEndOfDay(query.to)

  const invoiceWhere = `
    i.org_id = :orgId
    AND i.deleted_at IS NULL
    AND ${REPORT_STATUS_CLAUSE}
    AND i.issue_date IS NOT NULL
    ${branchClause}
    ${fromClause}
    ${toClause}
  `

  let rows: RawReportRow[]
  let totalsRow: RawTotalsRow | undefined

  if (query.group_by === 'period') {
    const { trunc, label } = GRANULARITY_SQL[query.granularity]
    rows = await sequelize.query<RawReportRow>(`
      SELECT
        TO_CHAR(p.period, 'YYYY-MM-DD') AS group_key,
        ${label} AS label,
        NULL AS secondary_label,
        p.documents::int AS documents,
        p.subtotal::text AS subtotal,
        p.tax::text AS tax,
        p.total::text AS total
      FROM (
        SELECT
          DATE_TRUNC('${trunc}', i.issue_date) AS period,
          COUNT(i.id) AS documents,
          COALESCE(SUM(CAST(i.subtotal AS NUMERIC)), 0) AS subtotal,
          COALESCE(SUM(CAST(i.tax_amount AS NUMERIC)), 0) AS tax,
          COALESCE(SUM(CAST(i.total AS NUMERIC)), 0) AS total
        FROM invoices i
        WHERE ${invoiceWhere}
        GROUP BY DATE_TRUNC('${trunc}', i.issue_date)
      ) p
      ORDER BY p.period ASC
      LIMIT :groupLimit
    `, { replacements, type: QueryTypes.SELECT })
  } else if (query.group_by === 'customer') {
    rows = await sequelize.query<RawReportRow>(`
      SELECT
        COALESCE(c.id::text, 'sin-cliente') AS group_key,
        COALESCE(c.legal_name, 'Sin cliente') AS label,
        c.trade_name AS secondary_label,
        COUNT(i.id)::int AS documents,
        COALESCE(SUM(CAST(i.subtotal AS NUMERIC)), 0)::text AS subtotal,
        COALESCE(SUM(CAST(i.tax_amount AS NUMERIC)), 0)::text AS tax,
        COALESCE(SUM(CAST(i.total AS NUMERIC)), 0)::text AS total
      FROM invoices i
      LEFT JOIN contacts c ON c.id = i.contact_id AND c.deleted_at IS NULL
      WHERE ${invoiceWhere}
      GROUP BY c.id, c.legal_name, c.trade_name
      ORDER BY COALESCE(SUM(CAST(i.total AS NUMERIC)), 0) DESC, label ASC
      LIMIT :groupLimit
    `, { replacements, type: QueryTypes.SELECT })
  } else {
    rows = await sequelize.query<RawReportRow>(`
      SELECT
        COALESCE(ii.variant_id::text, ii.product_id::text, 'desc:' || LOWER(ii.description)) AS group_key,
        COALESCE(MIN(p.name), MIN(ii.description)) AS label,
        MIN(COALESCE(v.name, v.sku)) AS secondary_label,
        COUNT(DISTINCT i.id)::int AS documents,
        COALESCE(SUM(CAST(ii.quantity AS NUMERIC)), 0)::text AS quantity,
        COALESCE(SUM(CAST(ii.subtotal AS NUMERIC)), 0)::text AS subtotal,
        COALESCE(SUM(CAST(ii.tax_amount AS NUMERIC)), 0)::text AS tax,
        COALESCE(SUM(CAST(ii.total AS NUMERIC)), 0)::text AS total
      FROM invoice_items ii
      JOIN invoices i ON i.id = ii.invoice_id
      LEFT JOIN products p ON p.id = ii.product_id AND p.deleted_at IS NULL
      LEFT JOIN product_variants v ON v.id = ii.variant_id AND v.deleted_at IS NULL
      WHERE ii.deleted_at IS NULL
        AND ${invoiceWhere}
      GROUP BY COALESCE(ii.variant_id::text, ii.product_id::text, 'desc:' || LOWER(ii.description))
      ORDER BY COALESCE(SUM(CAST(ii.total AS NUMERIC)), 0) DESC, label ASC
      LIMIT :groupLimit
    `, { replacements, type: QueryTypes.SELECT })
  }

  if (query.group_by === 'product') {
    ;[totalsRow] = await sequelize.query<RawTotalsRow>(`
      SELECT
        COUNT(DISTINCT i.id)::int AS documents,
        COALESCE(SUM(CAST(ii.quantity AS NUMERIC)), 0)::text AS quantity,
        COALESCE(SUM(CAST(ii.subtotal AS NUMERIC)), 0)::text AS subtotal,
        COALESCE(SUM(CAST(ii.tax_amount AS NUMERIC)), 0)::text AS tax,
        COALESCE(SUM(CAST(ii.total AS NUMERIC)), 0)::text AS total
      FROM invoice_items ii
      JOIN invoices i ON i.id = ii.invoice_id
      WHERE ii.deleted_at IS NULL
        AND ${invoiceWhere}
    `, { replacements, type: QueryTypes.SELECT })
  } else {
    ;[totalsRow] = await sequelize.query<RawTotalsRow>(`
      SELECT
        COUNT(i.id)::int AS documents,
        COALESCE(SUM(CAST(i.subtotal AS NUMERIC)), 0)::text AS subtotal,
        COALESCE(SUM(CAST(i.tax_amount AS NUMERIC)), 0)::text AS tax,
        COALESCE(SUM(CAST(i.total AS NUMERIC)), 0)::text AS total
      FROM invoices i
      WHERE ${invoiceWhere}
    `, { replacements, type: QueryTypes.SELECT })
  }

  const isProduct = query.group_by === 'product'
  const data: SalesReportRow[] = rows.map((row) => ({
    group_key: String(row.group_key),
    label: row.label ? String(row.label) : 'Sin datos',
    secondary_label: row.secondary_label ? String(row.secondary_label) : null,
    documents: Number(row.documents ?? 0),
    quantity: isProduct ? money(row.quantity) : null,
    subtotal: money(row.subtotal),
    tax: money(row.tax),
    total: money(row.total),
  }))

  const totals: SalesReportTotals = {
    documents: Number(totalsRow?.documents ?? 0),
    quantity: isProduct ? money(totalsRow?.quantity) : null,
    subtotal: money(totalsRow?.subtotal),
    tax: money(totalsRow?.tax),
    total: money(totalsRow?.total),
  }

  return {
    group_by: query.group_by,
    granularity: query.granularity,
    data,
    totals,
    truncated: data.length >= SALES_REPORT_GROUP_LIMIT,
  }
}
