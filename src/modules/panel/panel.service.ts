import 'server-only'
import sequelize from '@/lib/db'
import { QueryTypes } from 'sequelize'

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
interface PerformanceSeriesRow { label: string; facturado: string; cobrado: string }
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

export async function getPanelKpis(orgId: string, filters: PanelFilters) {
  const { from, to, prevFrom, prevTo } = resolveDateRange(filters)
  const bc = branchClause('i', filters.branch_id)
  const bc2 = branchClause('p', filters.branch_id)

  const [invoiceRows] = await sequelize.query<InvoiceKpiRow>(`
    SELECT
      COALESCE(SUM(CASE WHEN i.status NOT IN ('draft', 'cancelled') AND i.issue_date >= :from AND i.issue_date <= :to THEN CAST(i.total AS NUMERIC) END), 0)::text AS facturado_current,
      COALESCE(SUM(CASE WHEN i.status NOT IN ('draft', 'cancelled') AND i.issue_date >= :prevFrom AND i.issue_date < :from THEN CAST(i.total AS NUMERIC) END), 0)::text AS facturado_previous,
      COALESCE(SUM(CASE WHEN i.status IN ('issued', 'partially_paid') THEN CAST(i.balance AS NUMERIC) END), 0)::text AS cxc_value,
      COUNT(CASE WHEN i.status IN ('issued', 'partially_paid') AND i.due_date < NOW() AND CAST(i.balance AS NUMERIC) > 0 THEN 1 END)::text AS overdue_count
    FROM invoices i
    WHERE i.org_id = :orgId AND i.deleted_at IS NULL ${bc}
  `, { replacements: { orgId, from, to, prevFrom, prevTo }, type: QueryTypes.SELECT })

  const [cobradoRows] = await sequelize.query<KpiRow>(`
    SELECT
      COALESCE(SUM(CASE WHEN p.payment_date >= :from AND p.payment_date <= :to THEN CAST(p.amount AS NUMERIC) END), 0)::text AS current,
      COALESCE(SUM(CASE WHEN p.payment_date >= :prevFrom AND p.payment_date < :from THEN CAST(p.amount AS NUMERIC) END), 0)::text AS previous
    FROM payments p
    WHERE p.org_id = :orgId AND p.deleted_at IS NULL ${bc2}
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

  const pctChange = (cur: number, prev: number) =>
    prev === 0 ? 0 : Math.round(((cur - prev) / prev) * 100)

  return {
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
    saldo_cuenta: null,
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
             SUM(CAST(i.total AS NUMERIC)) AS total
      FROM invoices i
      WHERE i.org_id = :orgId AND i.deleted_at IS NULL
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
      COALESCE(c.total, 0)::text AS cobrado
    FROM buckets b
    LEFT JOIN facturado f ON f.bucket = b.gs
    LEFT JOIN cobrado c ON c.bucket = b.gs
    ORDER BY b.gs
  `, { replacements: { orgId, from, to }, type: QueryTypes.SELECT })

  return rows.map(r => ({
    label: r.label,
    facturado: parseFloat(r.facturado),
    cobrado: parseFloat(r.cobrado),
  }))
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

  const rows = await sequelize.query<{ label: string; value: string }>(`
    SELECT c.legal_name AS label, SUM(CAST(si.total AS NUMERIC))::text AS value
    FROM supplier_invoices si
    JOIN contacts c ON c.id = si.contact_id
    WHERE si.org_id = :orgId AND si.deleted_at IS NULL
      AND si.invoice_date >= :from AND si.invoice_date <= :to ${bc}
    GROUP BY c.legal_name
    ORDER BY SUM(CAST(si.total AS NUMERIC)) DESC
    LIMIT 6
  `, { replacements: { orgId, from, to }, type: QueryTypes.SELECT })

  return rows.map((r, i) => ({
    label: r.label,
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
  performance_series: PerformanceSeriesPoint[]
}

/** Loads all KPI/chart data for /api/v1/panel/kpis in one parallel batch (7 SQL round-trips). */
export async function getPanelKpisPayload(orgId: string, filters: PanelFilters): Promise<PanelKpisPayload> {
  const [kpis, counts, cash_flow, gastos, performance_series] = await Promise.all([
    getPanelKpis(orgId, filters),
    getPanelCounts(orgId, filters),
    getPanelCashFlow(orgId, filters),
    getPanelGastos(orgId, filters),
    getPanelPerformanceSeries(orgId, filters),
  ])

  return { kpis, counts, cash_flow, gastos, performance_series }
}
