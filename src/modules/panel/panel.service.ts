import 'server-only'
import sequelize from '@/lib/db'
import { QueryTypes } from 'sequelize'
import { OPEN_PAYABLE_INVOICE_STATUSES } from '@/modules/purchases/supplier-invoice.constants'
import { OPEN_PAYABLE_EXPENSE_STATUSES } from '@/modules/expenses/expense.constants'
import { OPEN_RECEIVABLE_INVOICE_STATUSES } from '@/modules/sales/invoice.constants'
import {
  calcCostCoveragePct,
  calcMargenBruto,
  calcMargenGananciaPct,
  calcPuntoEquilibrio,
  calcRentabilidad,
} from './panel-metrics'

export type PanelPeriod = 'last_week' | 'last_month' | 'last_3months' | 'last_year' | 'custom'

const VALID_PERIODS: PanelPeriod[] = ['last_week', 'last_month', 'last_3months', 'last_year', 'custom']

export interface PanelFilters {
  period: PanelPeriod
  from?: string
  to?: string
  branch_id?: string
}

export function parsePanelFilters(searchParams: URLSearchParams): PanelFilters {
  const period = (searchParams.get('period') ?? 'last_month') as PanelPeriod
  return {
    period: VALID_PERIODS.includes(period) ? period : 'last_month',
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
    branch_id: searchParams.get('branch_id') ?? undefined,
  }
}

function resolveDateRange(filters: PanelFilters): { from: Date; to: Date; prevFrom: Date; prevTo: Date } {
  const to = filters.to ? new Date(filters.to) : new Date()
  to.setHours(23, 59, 59, 999)

  let from: Date
  if (filters.period === 'custom' && filters.from) {
    from = new Date(filters.from)
  } else {
    from = new Date()
    if (filters.period === 'last_week') from.setDate(from.getDate() - 7)
    else if (filters.period === 'last_month') from.setMonth(from.getMonth() - 1)
    else if (filters.period === 'last_3months') from.setMonth(from.getMonth() - 3)
    else if (filters.period === 'last_year') from.setFullYear(from.getFullYear() - 1)
    else from.setMonth(from.getMonth() - 1)
  }
  from.setHours(0, 0, 0, 0)

  const diffMs = to.getTime() - from.getTime()
  const prevTo = new Date(from.getTime() - 1)
  const prevFrom = new Date(prevTo.getTime() - diffMs)

  return { from, to, prevFrom, prevTo }
}

function branchClause(alias: string, branchId?: string) {
  if (!branchId || branchId === 'all') return ''
  return `AND ${alias}.branch_id = '${branchId}'`
}

interface KpiRow { current: string; previous: string }
interface InvoiceKpiRow {
  facturado_current: string
  facturado_previous: string
  cxc_value: string
  overdue_count: string
}
interface SupplierInvoiceKpiRow {
  cxp_value: string
  overdue_count: string
}
interface CountsRow {
  productos: string
  clientes: string
  proveedores: string
  comprobantes: string
}
interface CashFlowRow { label: string; value: string }
interface CashFlowBundleRow {
  semanal: Array<{ label: string; value: number }> | string
  mensual: Array<{ label: string; value: number }> | string
  anual: Array<{ label: string; value: number }> | string
}
interface PerformanceSeriesRow {
  label: string
  facturado: string
  cobrado: string
  subtotal: string
  orders: string
  items_sold: string
}
interface SalesMetricsRow {
  total_current: string
  total_previous: string
  subtotal_current: string
  subtotal_previous: string
  orders_current: string
  orders_previous: string
  items_current: string
  items_previous: string
}
interface TopProductRow {
  id: string
  name: string
  image_url: string | null
  net_sales: string
  quantity_sold: string
}
interface SparkRow { month: string; value: string }
interface RecentInvoiceRow {
  invoice_number: string
  legal_name: string
  trade_name: string | null
  issue_date: Date
  total: string
  status: string
}
interface ActivityRow {
  type: string
  text: string
  occurred_at: Date
}
interface MarginKpiRow {
  net_sales_current: string
  net_sales_previous: string
  cmv_current: string
  cmv_previous: string
  covered_revenue_current: string
  total_revenue_current: string
}

export async function getPanelKpis(orgId: string, filters: PanelFilters) {
  const { from, to, prevFrom, prevTo } = resolveDateRange(filters)
  const bc = branchClause('i', filters.branch_id)
  const bc2 = branchClause('p', filters.branch_id)
  const bc3 = branchClause('si', filters.branch_id)

  const [invoiceRows] = await sequelize.query<InvoiceKpiRow>(`
    SELECT
      COALESCE(SUM(CASE WHEN i.status NOT IN ('draft', 'cancelled') AND i.issue_date >= :from AND i.issue_date <= :to THEN CAST(i.total AS NUMERIC) END), 0)::text AS facturado_current,
      COALESCE(SUM(CASE WHEN i.status NOT IN ('draft', 'cancelled') AND i.issue_date >= :prevFrom AND i.issue_date < :from THEN CAST(i.total AS NUMERIC) END), 0)::text AS facturado_previous,
      COALESCE(SUM(CASE WHEN i.status IN (:openReceivableStatuses) THEN CAST(i.balance AS NUMERIC) END), 0)::text AS cxc_value,
      COUNT(CASE WHEN i.status IN (:openReceivableStatuses) AND i.due_date < NOW() AND CAST(i.balance AS NUMERIC) > 0 THEN 1 END)::text AS overdue_count
    FROM invoices i
    WHERE i.org_id = :orgId AND i.deleted_at IS NULL ${bc}
  `, { replacements: { orgId, from, to, prevFrom, prevTo, openReceivableStatuses: [...OPEN_RECEIVABLE_INVOICE_STATUSES] }, type: QueryTypes.SELECT })

  const [supplierInvoiceRows] = await sequelize.query<SupplierInvoiceKpiRow>(`
    SELECT
      COALESCE(SUM(CASE WHEN si.status IN (:openPayableStatuses) THEN CAST(si.balance AS NUMERIC) END), 0)::text AS cxp_value,
      COUNT(CASE WHEN si.status IN (:openPayableStatuses) AND si.due_date < NOW() AND CAST(si.balance AS NUMERIC) > 0 THEN 1 END)::text AS overdue_count
    FROM supplier_invoices si
    WHERE si.org_id = :orgId AND si.deleted_at IS NULL ${bc3}
  `, { replacements: { orgId, openPayableStatuses: [...OPEN_PAYABLE_INVOICE_STATUSES] }, type: QueryTypes.SELECT })

  const bcExp = branchClause('e', filters.branch_id)
  const [expensePayableRows] = await sequelize.query<SupplierInvoiceKpiRow>(`
    SELECT
      COALESCE(SUM(CASE WHEN e.status IN (:openExpenseStatuses) THEN CAST(e.balance AS NUMERIC) END), 0)::text AS cxp_value,
      COUNT(CASE WHEN e.status IN (:openExpenseStatuses) AND e.due_date < NOW() AND CAST(e.balance AS NUMERIC) > 0 THEN 1 END)::text AS overdue_count
    FROM expenses e
    WHERE e.org_id = :orgId AND e.deleted_at IS NULL ${bcExp}
  `, { replacements: { orgId, openExpenseStatuses: [...OPEN_PAYABLE_EXPENSE_STATUSES] }, type: QueryTypes.SELECT })

  const [expensePeriodRows] = await sequelize.query<{ current: string; previous: string }>(`
    SELECT
      COALESCE(SUM(CASE WHEN e.status NOT IN ('draft', 'cancelled')
        AND COALESCE(e.invoice_date, e.created_at) >= :from
        AND COALESCE(e.invoice_date, e.created_at) <= :to
        THEN CAST(e.total AS NUMERIC) END), 0)::text AS current,
      COALESCE(SUM(CASE WHEN e.status NOT IN ('draft', 'cancelled')
        AND COALESCE(e.invoice_date, e.created_at) >= :prevFrom
        AND COALESCE(e.invoice_date, e.created_at) < :from
        THEN CAST(e.total AS NUMERIC) END), 0)::text AS previous
    FROM expenses e
    WHERE e.org_id = :orgId AND e.deleted_at IS NULL ${bcExp}
  `, { replacements: { orgId, from, to, prevFrom, prevTo }, type: QueryTypes.SELECT })

  const [cobradoRows] = await sequelize.query<KpiRow>(`
    SELECT
      COALESCE(SUM(CASE WHEN p.payment_date >= :from AND p.payment_date <= :to THEN CAST(p.amount AS NUMERIC) END), 0)::text AS current,
      COALESCE(SUM(CASE WHEN p.payment_date >= :prevFrom AND p.payment_date < :from THEN CAST(p.amount AS NUMERIC) END), 0)::text AS previous
    FROM payments p
    WHERE p.org_id = :orgId AND p.deleted_at IS NULL ${bc2}
  `, { replacements: { orgId, from, to, prevFrom, prevTo }, type: QueryTypes.SELECT })

  const [marginRows] = await sequelize.query<MarginKpiRow>(`
    SELECT
      COALESCE(SUM(CASE WHEN i.status NOT IN ('draft', 'cancelled') AND i.issue_date >= :from AND i.issue_date <= :to
        THEN CAST(ii.tax_base AS NUMERIC) END), 0)::text AS net_sales_current,
      COALESCE(SUM(CASE WHEN i.status NOT IN ('draft', 'cancelled') AND i.issue_date >= :prevFrom AND i.issue_date < :from
        THEN CAST(ii.tax_base AS NUMERIC) END), 0)::text AS net_sales_previous,
      COALESCE(SUM(CASE WHEN i.status NOT IN ('draft', 'cancelled') AND i.issue_date >= :from AND i.issue_date <= :to
        AND COALESCE(ii.unit_cost, pv.cost_price) IS NOT NULL
        THEN CAST(ii.quantity AS NUMERIC) * COALESCE(CAST(ii.unit_cost AS NUMERIC), CAST(pv.cost_price AS NUMERIC)) END), 0)::text AS cmv_current,
      COALESCE(SUM(CASE WHEN i.status NOT IN ('draft', 'cancelled') AND i.issue_date >= :prevFrom AND i.issue_date < :from
        AND COALESCE(ii.unit_cost, pv.cost_price) IS NOT NULL
        THEN CAST(ii.quantity AS NUMERIC) * COALESCE(CAST(ii.unit_cost AS NUMERIC), CAST(pv.cost_price AS NUMERIC)) END), 0)::text AS cmv_previous,
      COALESCE(SUM(CASE WHEN i.status NOT IN ('draft', 'cancelled') AND i.issue_date >= :from AND i.issue_date <= :to
        AND COALESCE(ii.unit_cost, pv.cost_price) IS NOT NULL
        THEN CAST(ii.tax_base AS NUMERIC) END), 0)::text AS covered_revenue_current,
      COALESCE(SUM(CASE WHEN i.status NOT IN ('draft', 'cancelled') AND i.issue_date >= :from AND i.issue_date <= :to
        THEN CAST(ii.tax_base AS NUMERIC) END), 0)::text AS total_revenue_current
    FROM invoices i
    INNER JOIN invoice_items ii ON ii.invoice_id = i.id AND ii.deleted_at IS NULL
    LEFT JOIN product_variants pv ON pv.id = ii.variant_id AND pv.deleted_at IS NULL
    WHERE i.org_id = :orgId AND i.deleted_at IS NULL ${bc}
  `, { replacements: { orgId, from, to, prevFrom, prevTo }, type: QueryTypes.SELECT })

  const sparkRows = await sequelize.query<SparkRow>(`
    SELECT
      TO_CHAR(DATE_TRUNC('month', i.issue_date), 'Mon') AS month,
      COALESCE(SUM(CAST(i.total AS NUMERIC)), 0)::text AS value
    FROM invoices i
    WHERE i.org_id = :orgId AND i.deleted_at IS NULL
      AND i.status NOT IN ('draft', 'cancelled')
      AND i.issue_date >= NOW() - INTERVAL '8 months' ${bc}
    GROUP BY DATE_TRUNC('month', i.issue_date)
    ORDER BY DATE_TRUNC('month', i.issue_date)
  `, { replacements: { orgId }, type: QueryTypes.SELECT })

  const facturadoCurrent = parseFloat(invoiceRows?.facturado_current ?? '0')
  const facturadoPrev = parseFloat(invoiceRows?.facturado_previous ?? '0')
  const cobradoCurrent = parseFloat(cobradoRows?.current ?? '0')
  const cobradoPrev = parseFloat(cobradoRows?.previous ?? '0')
  const expensesCurrent = parseFloat(expensePeriodRows?.current ?? '0')
  const expensesPrev = parseFloat(expensePeriodRows?.previous ?? '0')
  const porPagarPurchases = parseFloat(supplierInvoiceRows?.cxp_value ?? '0')
  const porPagarExpenses = parseFloat(expensePayableRows?.cxp_value ?? '0')
  const overduePurchases = parseInt(supplierInvoiceRows?.overdue_count ?? '0', 10)
  const overdueExpenses = parseInt(expensePayableRows?.overdue_count ?? '0', 10)

  const facturacionNetaCurrent = parseFloat(marginRows?.net_sales_current ?? '0')
  const facturacionNetaPrev = parseFloat(marginRows?.net_sales_previous ?? '0')
  const cmvCurrent = parseFloat(marginRows?.cmv_current ?? '0')
  const cmvPrev = parseFloat(marginRows?.cmv_previous ?? '0')
  const coveredRevenueCurrent = parseFloat(marginRows?.covered_revenue_current ?? '0')
  const totalRevenueCurrent = parseFloat(marginRows?.total_revenue_current ?? '0')

  const margenBrutoCurrent = calcMargenBruto(facturacionNetaCurrent, cmvCurrent)
  const margenBrutoPrev = calcMargenBruto(facturacionNetaPrev, cmvPrev)
  const margenGananciaCurrent = calcMargenGananciaPct(facturacionNetaCurrent, cmvCurrent)
  const margenGananciaPrev = calcMargenGananciaPct(facturacionNetaPrev, cmvPrev)
  const rentabilidadCurrent = calcRentabilidad(facturacionNetaCurrent, cmvCurrent, expensesCurrent)
  const rentabilidadPrev = calcRentabilidad(facturacionNetaPrev, cmvPrev, expensesPrev)
  const costCoveragePct = calcCostCoveragePct(coveredRevenueCurrent, totalRevenueCurrent)

  const pctChange = (cur: number, prev: number) =>
    prev === 0 ? 0 : Math.round(((cur - prev) / prev) * 100)

  const pctPointChange = (cur: number | null, prev: number | null) => {
    if (cur == null || prev == null) return 0
    return Math.round((cur - prev) * 100) / 100
  }

  return {
    facturacion_neta: {
      value: facturacionNetaCurrent,
      pct_change: pctChange(facturacionNetaCurrent, facturacionNetaPrev),
    },
    margen_bruto: {
      value: margenBrutoCurrent,
      pct_change: pctChange(margenBrutoCurrent, margenBrutoPrev),
    },
    margen_ganancia_pct: {
      value: margenGananciaCurrent,
      pct_change: pctPointChange(margenGananciaCurrent, margenGananciaPrev),
    },
    rentabilidad: {
      value: rentabilidadCurrent.value,
      pct: rentabilidadCurrent.pct,
      pct_change: pctChange(rentabilidadCurrent.value, rentabilidadPrev.value),
    },
    punto_equilibrio: calcPuntoEquilibrio(expensesCurrent, margenGananciaCurrent),
    cost_coverage_pct: costCoveragePct,
    facturado: {
      value: facturadoCurrent,
      pct_change: pctChange(facturadoCurrent, facturadoPrev),
      spark: sparkRows.map(r => parseFloat(r.value)),
    },
    cobrado: {
      value: cobradoCurrent,
      pct_change: pctChange(cobradoCurrent, cobradoPrev),
      spark: sparkRows.map(r => parseFloat(r.value)),
    },
    por_cobrar: {
      value: parseFloat(invoiceRows?.cxc_value ?? '0'),
      overdue_count: parseInt(invoiceRows?.overdue_count ?? '0', 10),
    },
    por_pagar: {
      value: porPagarPurchases + porPagarExpenses,
      overdue_count: overduePurchases + overdueExpenses,
    },
    expensas: {
      value: expensesCurrent,
      pct_change: pctChange(expensesCurrent, expensesPrev),
    },
    saldo_cuenta: null,
    saldo_cuenta_status: 'unavailable_treasury' as const,
  }
}

export async function getPanelCounts(orgId: string, filters: PanelFilters) {
  const { from, to } = resolveDateRange(filters)
  const bc = branchClause('i', filters.branch_id)

  const [countsRow] = await sequelize.query<CountsRow>(`
    SELECT
      (SELECT COUNT(*)::text FROM products WHERE org_id = :orgId AND deleted_at IS NULL AND status = 'active') AS productos,
      (SELECT COUNT(*)::text FROM contacts WHERE org_id = :orgId AND deleted_at IS NULL AND type IN ('customer', 'both')) AS clientes,
      (SELECT COUNT(*)::text FROM contacts WHERE org_id = :orgId AND deleted_at IS NULL AND type IN ('supplier', 'both')) AS proveedores,
      (SELECT COUNT(*)::text FROM invoices i WHERE i.org_id = :orgId AND i.deleted_at IS NULL AND i.issue_date >= :from AND i.issue_date <= :to ${bc}) AS comprobantes
  `, { replacements: { orgId, from, to }, type: QueryTypes.SELECT })

  return {
    productos: parseInt(countsRow?.productos ?? '0', 10),
    clientes: parseInt(countsRow?.clientes ?? '0', 10),
    proveedores: parseInt(countsRow?.proveedores ?? '0', 10),
    comprobantes: parseInt(countsRow?.comprobantes ?? '0', 10),
  }
}

export interface PerformanceSeriesPoint {
  label: string
  facturado: number
  cobrado: number
  subtotal: number
  orders: number
  items_sold: number
}

import type { PanelAnalytics, PanelMetricWithTrend, PanelTopProduct } from './panel.types'
export type { PanelAnalytics, PanelMetricWithTrend, PanelTopProduct } from './panel.types'

function pctChange(cur: number, prev: number): number {
  return prev === 0 ? 0 : Math.round(((cur - prev) / prev) * 100)
}

function metricWithTrend(cur: number, prev: number, spark: number[]): PanelMetricWithTrend {
  return { value: cur, pct_change: pctChange(cur, prev), spark }
}

function formatComparePeriodLabel(from: Date, to: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
  return `Comparado con ${fmt(from)} – ${fmt(to)}`
}

function resolvePerformanceBucket(filters: PanelFilters): {
  truncUnit: 'day' | 'week' | 'month'
  interval: string
  labelSql: string
} {
  const { from, to } = resolveDateRange(filters)
  const diffDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000))

  if (diffDays <= 14) {
    return { truncUnit: 'day', interval: '1 day', labelSql: "TO_CHAR(gs, 'DD/MM')" }
  }
  if (diffDays <= 90) {
    return { truncUnit: 'week', interval: '1 week', labelSql: "TO_CHAR(gs, 'DD/MM')" }
  }
  return { truncUnit: 'month', interval: '1 month', labelSql: "TO_CHAR(gs, 'Mon')" }
}

export async function getPanelPerformanceSeries(orgId: string, filters: PanelFilters): Promise<PerformanceSeriesPoint[]> {
  const { from, to } = resolveDateRange(filters)
  const bcInv = branchClause('i', filters.branch_id)
  const bcPay = branchClause('p', filters.branch_id)
  const { truncUnit, interval, labelSql } = resolvePerformanceBucket(filters)
  const labelExpr = labelSql.replace(/\bgs\b/g, 'b.gs')

  const rows = await sequelize.query<PerformanceSeriesRow>(`
    WITH buckets AS (
      SELECT gs FROM generate_series(
        DATE_TRUNC('${truncUnit}', :from::timestamptz),
        DATE_TRUNC('${truncUnit}', :to::timestamptz),
        '${interval}'::interval
      ) gs
    ),
    facturado AS (
      SELECT DATE_TRUNC('${truncUnit}', i.issue_date) AS bucket,
             SUM(CAST(i.total AS NUMERIC)) AS total,
             SUM(CAST(i.subtotal AS NUMERIC)) AS subtotal,
             COUNT(*)::int AS orders
      FROM invoices i
      WHERE i.org_id = :orgId AND i.deleted_at IS NULL
        AND i.status NOT IN ('draft', 'cancelled')
        AND i.issue_date >= :from AND i.issue_date <= :to
        ${bcInv}
      GROUP BY 1
    ),
    items AS (
      SELECT DATE_TRUNC('${truncUnit}', i.issue_date) AS bucket,
             SUM(CAST(ii.quantity AS NUMERIC)) AS qty
      FROM invoice_items ii
      JOIN invoices i ON i.id = ii.invoice_id
      WHERE ii.deleted_at IS NULL
        AND i.org_id = :orgId AND i.deleted_at IS NULL
        AND i.status NOT IN ('draft', 'cancelled')
        AND i.issue_date >= :from AND i.issue_date <= :to
        ${bcInv}
      GROUP BY 1
    ),
    cobrado AS (
      SELECT DATE_TRUNC('${truncUnit}', p.payment_date) AS bucket,
             SUM(CAST(p.amount AS NUMERIC)) AS total
      FROM payments p
      WHERE p.org_id = :orgId AND p.deleted_at IS NULL
        AND p.payment_date >= :from AND p.payment_date <= :to
        ${bcPay}
      GROUP BY 1
    )
    SELECT
      ${labelExpr} AS label,
      COALESCE(f.total, 0)::text AS facturado,
      COALESCE(c.total, 0)::text AS cobrado,
      COALESCE(f.subtotal, 0)::text AS subtotal,
      COALESCE(f.orders, 0)::text AS orders,
      COALESCE(it.qty, 0)::text AS items_sold
    FROM buckets b
    LEFT JOIN facturado f ON f.bucket = b.gs
    LEFT JOIN cobrado c ON c.bucket = b.gs
    LEFT JOIN items it ON it.bucket = b.gs
    ORDER BY b.gs
  `, { replacements: { orgId, from, to }, type: QueryTypes.SELECT })

  return rows.map(r => ({
    label: r.label,
    facturado: parseFloat(r.facturado),
    cobrado: parseFloat(r.cobrado),
    subtotal: parseFloat(r.subtotal),
    orders: parseFloat(r.orders),
    items_sold: parseFloat(r.items_sold),
  }))
}

export async function getPanelSalesMetrics(orgId: string, filters: PanelFilters) {
  const { from, to, prevFrom, prevTo } = resolveDateRange(filters)
  const bc = branchClause('i', filters.branch_id)
  const bcItems = branchClause('i2', filters.branch_id)

  const [row] = await sequelize.query<SalesMetricsRow>(`
    SELECT
      COALESCE(SUM(CASE WHEN i.status NOT IN ('draft', 'cancelled') AND i.issue_date >= :from AND i.issue_date <= :to THEN CAST(i.total AS NUMERIC) END), 0)::text AS total_current,
      COALESCE(SUM(CASE WHEN i.status NOT IN ('draft', 'cancelled') AND i.issue_date >= :prevFrom AND i.issue_date < :from THEN CAST(i.total AS NUMERIC) END), 0)::text AS total_previous,
      COALESCE(SUM(CASE WHEN i.status NOT IN ('draft', 'cancelled') AND i.issue_date >= :from AND i.issue_date <= :to THEN CAST(i.subtotal AS NUMERIC) END), 0)::text AS subtotal_current,
      COALESCE(SUM(CASE WHEN i.status NOT IN ('draft', 'cancelled') AND i.issue_date >= :prevFrom AND i.issue_date < :from THEN CAST(i.subtotal AS NUMERIC) END), 0)::text AS subtotal_previous,
      COUNT(CASE WHEN i.status NOT IN ('draft', 'cancelled') AND i.issue_date >= :from AND i.issue_date <= :to THEN 1 END)::text AS orders_current,
      COUNT(CASE WHEN i.status NOT IN ('draft', 'cancelled') AND i.issue_date >= :prevFrom AND i.issue_date < :from THEN 1 END)::text AS orders_previous,
      (
        SELECT COALESCE(SUM(CAST(ii.quantity AS NUMERIC)), 0)::text
        FROM invoice_items ii
        JOIN invoices i2 ON i2.id = ii.invoice_id
        WHERE ii.deleted_at IS NULL
          AND i2.org_id = :orgId AND i2.deleted_at IS NULL
          AND i2.status NOT IN ('draft', 'cancelled')
          AND i2.issue_date >= :from AND i2.issue_date <= :to
          ${bcItems}
      ) AS items_current,
      (
        SELECT COALESCE(SUM(CAST(ii.quantity AS NUMERIC)), 0)::text
        FROM invoice_items ii
        JOIN invoices i2 ON i2.id = ii.invoice_id
        WHERE ii.deleted_at IS NULL
          AND i2.org_id = :orgId AND i2.deleted_at IS NULL
          AND i2.status NOT IN ('draft', 'cancelled')
          AND i2.issue_date >= :prevFrom AND i2.issue_date < :from
          ${bcItems}
      ) AS items_previous
    FROM invoices i
    WHERE i.org_id = :orgId AND i.deleted_at IS NULL ${bc}
  `, { replacements: { orgId, from, to, prevFrom, prevTo }, type: QueryTypes.SELECT })

  return row ?? {
    total_current: '0',
    total_previous: '0',
    subtotal_current: '0',
    subtotal_previous: '0',
    orders_current: '0',
    orders_previous: '0',
    items_current: '0',
    items_previous: '0',
  }
}

export async function getPanelTopProducts(orgId: string, filters: PanelFilters, limit = 5): Promise<PanelTopProduct[]> {
  const { from, to } = resolveDateRange(filters)
  const bc = branchClause('i', filters.branch_id)

  const rows = await sequelize.query<TopProductRow>(`
    SELECT
      COALESCE(ii.variant_id::text, ii.product_id::text, 'desc:' || LOWER(ii.description)) AS id,
      COALESCE(MIN(p.name), MIN(ii.description)) AS name,
      MIN(p.images->0->>'url') AS image_url,
      COALESCE(SUM(CAST(ii.subtotal AS NUMERIC)), 0)::text AS net_sales,
      COALESCE(SUM(CAST(ii.quantity AS NUMERIC)), 0)::text AS quantity_sold
    FROM invoice_items ii
    JOIN invoices i ON i.id = ii.invoice_id
    LEFT JOIN products p ON p.id = ii.product_id AND p.deleted_at IS NULL
    WHERE ii.deleted_at IS NULL
      AND i.org_id = :orgId AND i.deleted_at IS NULL
      AND i.status NOT IN ('draft', 'cancelled')
      AND i.issue_date >= :from AND i.issue_date <= :to
      ${bc}
    GROUP BY COALESCE(ii.variant_id::text, ii.product_id::text, 'desc:' || LOWER(ii.description))
    ORDER BY COALESCE(SUM(CAST(ii.quantity AS NUMERIC)), 0) DESC, name ASC
    LIMIT :limit
  `, { replacements: { orgId, from, to, limit }, type: QueryTypes.SELECT })

  return rows.map(r => ({
    id: r.id,
    name: r.name,
    image_url: r.image_url,
    net_sales: parseFloat(r.net_sales),
    quantity_sold: parseFloat(r.quantity_sold),
  }))
}

export function buildPanelAnalytics(
  series: PerformanceSeriesPoint[],
  metrics: SalesMetricsRow,
  topProducts: PanelTopProduct[],
  comparePeriodLabel: string,
): PanelAnalytics {
  const totalCur = parseFloat(metrics.total_current)
  const totalPrev = parseFloat(metrics.total_previous)
  const subtotalCur = parseFloat(metrics.subtotal_current)
  const subtotalPrev = parseFloat(metrics.subtotal_previous)
  const ordersCur = parseInt(metrics.orders_current, 10)
  const ordersPrev = parseInt(metrics.orders_previous, 10)
  const itemsCur = parseFloat(metrics.items_current)
  const itemsPrev = parseFloat(metrics.items_previous)
  const avgCur = ordersCur > 0 ? totalCur / ordersCur : 0
  const avgPrev = ordersPrev > 0 ? totalPrev / ordersPrev : 0

  const sparks = {
    total: series.map(p => p.facturado),
    net: series.map(p => p.subtotal),
    orders: series.map(p => p.orders),
    items: series.map(p => p.items_sold),
  }

  return {
    compare_period_label: comparePeriodLabel,
    revenue: {
      total_sales: metricWithTrend(totalCur, totalPrev, sparks.total),
      net_sales: metricWithTrend(subtotalCur, subtotalPrev, sparks.net),
    },
    orders: {
      total_orders: metricWithTrend(ordersCur, ordersPrev, sparks.orders),
      avg_order_value: metricWithTrend(avgCur, avgPrev, sparks.total),
    },
    products: {
      items_sold: metricWithTrend(itemsCur, itemsPrev, sparks.items),
      top: topProducts,
    },
  }
}

export async function getPanelAnalytics(
  orgId: string,
  filters: PanelFilters,
  performanceSeries: PerformanceSeriesPoint[],
): Promise<PanelAnalytics> {
  const { prevFrom, prevTo } = resolveDateRange(filters)
  const [metrics, topProducts] = await Promise.all([
    getPanelSalesMetrics(orgId, filters),
    getPanelTopProducts(orgId, filters),
  ])

  return buildPanelAnalytics(
    performanceSeries,
    metrics,
    topProducts,
    formatComparePeriodLabel(prevFrom, prevTo),
  )
}

export async function getPanelCashFlow(orgId: string, filters: PanelFilters) {
  const bc = branchClause('i', filters.branch_id)

  const [bundle] = await sequelize.query<CashFlowBundleRow>(`
    WITH weekly_buckets AS (
      SELECT gs::date AS bucket, gs AS ord
      FROM generate_series(NOW()::date - 6, NOW()::date, '1 day'::interval) gs
    ),
    weekly_totals AS (
      SELECT DATE_TRUNC('day', i.issue_date)::date AS bucket,
             SUM(CAST(i.total AS NUMERIC)) AS total
      FROM invoices i
      WHERE i.org_id = :orgId AND i.deleted_at IS NULL
        AND i.status NOT IN ('draft', 'cancelled')
        AND i.issue_date >= (NOW()::date - 6)
        AND i.issue_date < (NOW()::date + INTERVAL '1 day')
        ${bc}
      GROUP BY 1
    ),
    weekly_series AS (
      SELECT TO_CHAR(b.bucket, 'Dy') AS label, COALESCE(t.total, 0)::float8 AS value, b.ord
      FROM weekly_buckets b
      LEFT JOIN weekly_totals t ON t.bucket = b.bucket
    ),
    monthly_buckets AS (
      SELECT gs AS bucket, gs AS ord
      FROM generate_series(
        DATE_TRUNC('week', NOW()::date - 27),
        DATE_TRUNC('week', NOW()::date),
        '1 week'::interval
      ) gs
    ),
    monthly_totals AS (
      SELECT DATE_TRUNC('week', i.issue_date) AS bucket,
             SUM(CAST(i.total AS NUMERIC)) AS total
      FROM invoices i
      WHERE i.org_id = :orgId AND i.deleted_at IS NULL
        AND i.status NOT IN ('draft', 'cancelled')
        AND i.issue_date >= DATE_TRUNC('week', NOW()::date - 27)
        AND i.issue_date < DATE_TRUNC('week', NOW()::date) + INTERVAL '1 week'
        ${bc}
      GROUP BY 1
    ),
    monthly_series AS (
      SELECT TO_CHAR(b.bucket, 'DD/MM') AS label, COALESCE(t.total, 0)::float8 AS value, b.ord
      FROM monthly_buckets b
      LEFT JOIN monthly_totals t ON t.bucket = b.bucket
    ),
    annual_buckets AS (
      SELECT gs AS bucket, gs AS ord
      FROM generate_series(
        DATE_TRUNC('month', NOW() - INTERVAL '11 months'),
        DATE_TRUNC('month', NOW()),
        '1 month'::interval
      ) gs
    ),
    annual_totals AS (
      SELECT DATE_TRUNC('month', i.issue_date) AS bucket,
             SUM(CAST(i.total AS NUMERIC)) AS total
      FROM invoices i
      WHERE i.org_id = :orgId AND i.deleted_at IS NULL
        AND i.status NOT IN ('draft', 'cancelled')
        AND i.issue_date >= DATE_TRUNC('month', NOW() - INTERVAL '11 months')
        AND i.issue_date < DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
        ${bc}
      GROUP BY 1
    ),
    annual_series AS (
      SELECT TO_CHAR(b.bucket, 'Mon') AS label, COALESCE(t.total, 0)::float8 AS value, b.ord
      FROM annual_buckets b
      LEFT JOIN annual_totals t ON t.bucket = b.bucket
    )
    SELECT
      (SELECT COALESCE(json_agg(json_build_object('label', label, 'value', value) ORDER BY ord), '[]'::json) FROM weekly_series) AS semanal,
      (SELECT COALESCE(json_agg(json_build_object('label', label, 'value', value) ORDER BY ord), '[]'::json) FROM monthly_series) AS mensual,
      (SELECT COALESCE(json_agg(json_build_object('label', label, 'value', value) ORDER BY ord), '[]'::json) FROM annual_series) AS anual
  `, { replacements: { orgId }, type: QueryTypes.SELECT })

  const parseSeries = (raw: CashFlowBundleRow['semanal']) => {
    const rows = typeof raw === 'string' ? JSON.parse(raw) as CashFlowRow[] : raw
    return (rows ?? []).map(r => ({ label: r.label, value: typeof r.value === 'number' ? r.value : parseFloat(String(r.value)) }))
  }

  return {
    semanal: parseSeries(bundle?.semanal ?? []),
    mensual: parseSeries(bundle?.mensual ?? []),
    anual: parseSeries(bundle?.anual ?? []),
  }
}

const DONUT_COLORS = ['#0C647A', '#0E7E9A', '#38A3BF', '#6EC9DF', '#A2DCE7', '#D0EEF3']

export async function getPanelGastos(orgId: string, filters: PanelFilters) {
  const { from, to } = resolveDateRange(filters)
  const bc = branchClause('si', filters.branch_id)
  const bcExp = branchClause('e', filters.branch_id)

  const rows = await sequelize.query<{ label: string; value: string }>(`
    SELECT label, SUM(value)::text AS value FROM (
      SELECT c.legal_name AS label, CAST(si.total AS NUMERIC) AS value
      FROM supplier_invoices si
      JOIN contacts c ON c.id = si.contact_id
      WHERE si.org_id = :orgId AND si.deleted_at IS NULL
        AND si.invoice_date >= :from AND si.invoice_date <= :to ${bc}
      UNION ALL
      SELECT c.legal_name AS label, CAST(e.total AS NUMERIC) AS value
      FROM expenses e
      JOIN contacts c ON c.id = e.contact_id
      WHERE e.org_id = :orgId AND e.deleted_at IS NULL
        AND e.status NOT IN ('draft', 'cancelled')
        AND COALESCE(e.invoice_date, e.created_at) >= :from
        AND COALESCE(e.invoice_date, e.created_at) <= :to ${bcExp}
    ) combined
    GROUP BY label
    ORDER BY SUM(value) DESC
    LIMIT 6
  `, { replacements: { orgId, from, to }, type: QueryTypes.SELECT })

  return rows.map((r, i) => ({
    label: r.label,
    value: parseFloat(r.value),
    color: DONUT_COLORS[i] ?? '#A2DCE7',
  }))
}

const EXPENSE_KIND_LABEL: Record<string, string> = {
  one_off: 'Único',
  recurring_occurrence: 'Recurrente',
  installment_plan: 'Plan / cuotas',
}

export async function getPanelExpensesByKind(orgId: string, filters: PanelFilters) {
  const { from, to } = resolveDateRange(filters)
  const bc = branchClause('e', filters.branch_id)

  const rows = await sequelize.query<{ kind: string; value: string }>(`
    SELECT e.kind, SUM(CAST(e.total AS NUMERIC))::text AS value
    FROM expenses e
    WHERE e.org_id = :orgId AND e.deleted_at IS NULL
      AND e.status NOT IN ('draft', 'cancelled')
      AND COALESCE(e.invoice_date, e.created_at) >= :from
      AND COALESCE(e.invoice_date, e.created_at) <= :to ${bc}
    GROUP BY e.kind
    ORDER BY SUM(CAST(e.total AS NUMERIC)) DESC
  `, { replacements: { orgId, from, to }, type: QueryTypes.SELECT })

  return rows.map((r, i) => ({
    label: EXPENSE_KIND_LABEL[r.kind] ?? r.kind,
    value: parseFloat(r.value),
    color: DONUT_COLORS[i] ?? '#A2DCE7',
  }))
}

export async function getPanelRecentInvoices(orgId: string, filters: PanelFilters) {
  const bc = branchClause('i', filters.branch_id)

  const rows = await sequelize.query<RecentInvoiceRow>(`
    SELECT i.invoice_number, c.legal_name, c.trade_name, i.issue_date, i.total, i.status
    FROM invoices i
    LEFT JOIN contacts c ON c.id = i.contact_id
    WHERE i.org_id = :orgId AND i.deleted_at IS NULL AND i.status != 'draft' ${bc}
    ORDER BY i.issue_date DESC, i.created_at DESC
    LIMIT 5
  `, { replacements: { orgId }, type: QueryTypes.SELECT })

  return rows.map(r => ({
    numero: r.invoice_number,
    cliente: r.trade_name ?? r.legal_name ?? '—',
    fecha: r.issue_date
      ? new Date(r.issue_date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '—',
    total: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(parseFloat(r.total ?? '0')),
    status: r.status,
  }))
}

export async function getPanelActivity(orgId: string, filters: PanelFilters) {
  const { from, to } = resolveDateRange(filters)
  const invoiceBranch = branchClause('i', filters.branch_id)
  const paymentBranch = branchClause('p', filters.branch_id)
  const poBranch = branchClause('po', filters.branch_id)
  const stockBranch = filters.branch_id && filters.branch_id !== 'all'
    ? `AND w.branch_id = '${filters.branch_id}'`
    : ''

  const rows = await sequelize.query<ActivityRow>(`
    SELECT type, text, occurred_at FROM (
      SELECT 'invoice' AS type,
        CONCAT(i.invoice_number, ' — ', COALESCE(c.trade_name, c.legal_name, 'Sin cliente')) AS text,
        i.updated_at AS occurred_at
      FROM invoices i
      LEFT JOIN contacts c ON c.id = i.contact_id
      WHERE i.org_id = :orgId AND i.deleted_at IS NULL AND i.status != 'draft'
        AND i.updated_at >= :from AND i.updated_at <= :to ${invoiceBranch}

      UNION ALL

      SELECT 'payment' AS type,
        CONCAT('Cobro ', p.payment_number, ' — ', COALESCE(c.trade_name, c.legal_name, 'Sin cliente')) AS text,
        p.updated_at AS occurred_at
      FROM payments p
      LEFT JOIN contacts c ON c.id = p.contact_id
      WHERE p.org_id = :orgId AND p.deleted_at IS NULL
        AND p.updated_at >= :from AND p.updated_at <= :to ${paymentBranch}

      UNION ALL

      SELECT 'stock' AS type,
        CONCAT(
          CASE sm.movement_type
            WHEN 'in' THEN 'Entrada'
            WHEN 'out' THEN 'Salida'
            WHEN 'adjustment' THEN 'Ajuste'
            ELSE 'Movimiento'
          END,
          ' stock — ', COALESCE(pv.sku, 'SKU'), ' (', w.name, ')'
        ) AS text,
        sm.created_at AS occurred_at
      FROM stock_movements sm
      JOIN warehouses w ON w.id = sm.warehouse_id
      LEFT JOIN product_variants pv ON pv.id = sm.variant_id
      WHERE sm.org_id = :orgId
        AND sm.created_at >= :from AND sm.created_at <= :to ${stockBranch}

      UNION ALL

      SELECT 'purchase' AS type,
        CONCAT('OC ', po.order_number, ' — ', COALESCE(c.trade_name, c.legal_name, 'Sin proveedor')) AS text,
        po.updated_at AS occurred_at
      FROM purchase_orders po
      LEFT JOIN contacts c ON c.id = po.contact_id
      WHERE po.org_id = :orgId AND po.deleted_at IS NULL AND po.status != 'draft'
        AND po.updated_at >= :from AND po.updated_at <= :to ${poBranch}
    ) activity
    ORDER BY occurred_at DESC
    LIMIT 15
  `, { replacements: { orgId, from, to }, type: QueryTypes.SELECT })

  return rows.map(r => {
    const diff = Date.now() - new Date(r.occurred_at).getTime()
    const mins = Math.round(diff / 60000)
    const hrs = Math.round(diff / 3600000)
    const days = Math.round(diff / 86400000)
    const time = mins < 60 ? `hace ${mins} min` : hrs < 24 ? `hace ${hrs} h` : days === 1 ? 'ayer' : `hace ${days} días`
    return { type: r.type, text: r.text, time }
  })
}

export interface PanelKpisPayload {
  kpis: Awaited<ReturnType<typeof getPanelKpis>>
  counts: Awaited<ReturnType<typeof getPanelCounts>>
  cash_flow: Awaited<ReturnType<typeof getPanelCashFlow>>
  gastos: Awaited<ReturnType<typeof getPanelGastos>>
  expenses_by_kind: Awaited<ReturnType<typeof getPanelExpensesByKind>>
  performance_series: PerformanceSeriesPoint[]
  analytics: PanelAnalytics
}

/** Loads all KPI/chart data for /api/v1/panel/kpis in one parallel batch. */
export async function getPanelKpisPayload(orgId: string, filters: PanelFilters): Promise<PanelKpisPayload> {
  const [kpis, counts, cash_flow, gastos, expenses_by_kind, performance_series, salesMetrics, topProducts] = await Promise.all([
    getPanelKpis(orgId, filters),
    getPanelCounts(orgId, filters),
    getPanelCashFlow(orgId, filters),
    getPanelGastos(orgId, filters),
    getPanelExpensesByKind(orgId, filters),
    getPanelPerformanceSeries(orgId, filters),
    getPanelSalesMetrics(orgId, filters),
    getPanelTopProducts(orgId, filters),
  ])

  const { prevFrom, prevTo } = resolveDateRange(filters)
  const analytics = buildPanelAnalytics(
    performance_series,
    salesMetrics,
    topProducts,
    formatComparePeriodLabel(prevFrom, prevTo),
  )

  return { kpis, counts, cash_flow, gastos, expenses_by_kind, performance_series, analytics }
}
