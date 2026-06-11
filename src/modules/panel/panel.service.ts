import 'server-only'
import sequelize from '@/lib/db'
import { QueryTypes } from 'sequelize'

export type PanelPeriod = 'last_week' | 'last_month' | 'last_3months' | 'last_year' | 'custom'

export interface PanelFilters {
  period: PanelPeriod
  from?: string
  to?: string
  branch_id?: string
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
interface CountRow { count: string }
interface CashFlowRow { label: string; value: string }
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

  const [facturadoRows] = await sequelize.query<KpiRow>(`
    SELECT
      COALESCE(SUM(CASE WHEN i.issue_date >= :from AND i.issue_date <= :to THEN CAST(i.total AS NUMERIC) END), 0)::text AS current,
      COALESCE(SUM(CASE WHEN i.issue_date >= :prevFrom AND i.issue_date < :from THEN CAST(i.total AS NUMERIC) END), 0)::text AS previous
    FROM invoices i
    WHERE i.org_id = :orgId AND i.deleted_at IS NULL AND i.status NOT IN ('draft', 'cancelled') ${bc}
  `, { replacements: { orgId, from, to, prevFrom, prevTo }, type: QueryTypes.SELECT })

  const [cobradoRows] = await sequelize.query<KpiRow>(`
    SELECT
      COALESCE(SUM(CASE WHEN p.payment_date >= :from AND p.payment_date <= :to THEN CAST(p.amount AS NUMERIC) END), 0)::text AS current,
      COALESCE(SUM(CASE WHEN p.payment_date >= :prevFrom AND p.payment_date < :from THEN CAST(p.amount AS NUMERIC) END), 0)::text AS previous
    FROM payments p
    WHERE p.org_id = :orgId AND p.deleted_at IS NULL ${bc2}
  `, { replacements: { orgId, from, to, prevFrom, prevTo }, type: QueryTypes.SELECT })

  const [cxcRows] = await sequelize.query<{ value: string; overdue_count: string }>(`
    SELECT
      COALESCE(SUM(CAST(i.balance AS NUMERIC)), 0)::text AS value,
      COUNT(CASE WHEN i.due_date < NOW() AND CAST(i.balance AS NUMERIC) > 0 THEN 1 END)::text AS overdue_count
    FROM invoices i
    WHERE i.org_id = :orgId AND i.deleted_at IS NULL AND i.status IN ('issued', 'partially_paid') ${bc}
  `, { replacements: { orgId }, type: QueryTypes.SELECT })

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

  const facturadoCurrent = parseFloat(facturadoRows?.current ?? '0')
  const facturadoPrev = parseFloat(facturadoRows?.previous ?? '0')
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
      value: parseFloat(cxcRows?.value ?? '0'),
      overdue_count: parseInt(cxcRows?.overdue_count ?? '0', 10),
    },
    saldo_cuenta: null,
  }
}

export async function getPanelCounts(orgId: string, filters: PanelFilters) {
  const { from, to } = resolveDateRange(filters)
  const bc = branchClause('i', filters.branch_id)

  const [productsRow] = await sequelize.query<CountRow>(
    `SELECT COUNT(*)::text AS count FROM products WHERE org_id = :orgId AND deleted_at IS NULL AND status = 'active'`,
    { replacements: { orgId }, type: QueryTypes.SELECT },
  )
  const [clientsRow] = await sequelize.query<CountRow>(
    `SELECT COUNT(*)::text AS count FROM contacts WHERE org_id = :orgId AND deleted_at IS NULL AND type IN ('customer', 'both')`,
    { replacements: { orgId }, type: QueryTypes.SELECT },
  )
  const [suppliersRow] = await sequelize.query<CountRow>(
    `SELECT COUNT(*)::text AS count FROM contacts WHERE org_id = :orgId AND deleted_at IS NULL AND type IN ('supplier', 'both')`,
    { replacements: { orgId }, type: QueryTypes.SELECT },
  )
  const [comprobantesRow] = await sequelize.query<CountRow>(`
    SELECT COUNT(*)::text AS count FROM invoices i
    WHERE i.org_id = :orgId AND i.deleted_at IS NULL
      AND i.issue_date >= :from AND i.issue_date <= :to ${bc}
  `, { replacements: { orgId, from, to }, type: QueryTypes.SELECT })

  return {
    productos: parseInt(productsRow?.count ?? '0', 10),
    clientes: parseInt(clientsRow?.count ?? '0', 10),
    proveedores: parseInt(suppliersRow?.count ?? '0', 10),
    comprobantes: parseInt(comprobantesRow?.count ?? '0', 10),
  }
}

export async function getPanelCashFlow(orgId: string, filters: PanelFilters) {
  const bc = branchClause('i', filters.branch_id)

  const weeklyRows = await sequelize.query<CashFlowRow>(`
    SELECT TO_CHAR(gs, 'Dy') AS label,
      COALESCE((
        SELECT SUM(CAST(i.total AS NUMERIC)) FROM invoices i
        WHERE i.org_id = :orgId AND i.deleted_at IS NULL
          AND i.status NOT IN ('draft','cancelled')
          AND DATE_TRUNC('day', i.issue_date) = gs ${bc}
      ), 0)::text AS value
    FROM generate_series(NOW()::date - 6, NOW()::date, '1 day'::interval) gs
    ORDER BY gs
  `, { replacements: { orgId }, type: QueryTypes.SELECT })

  const monthlyRows = await sequelize.query<CashFlowRow>(`
    SELECT TO_CHAR(gs, 'DD/MM') AS label,
      COALESCE((
        SELECT SUM(CAST(i.total AS NUMERIC)) FROM invoices i
        WHERE i.org_id = :orgId AND i.deleted_at IS NULL
          AND i.status NOT IN ('draft','cancelled')
          AND DATE_TRUNC('week', i.issue_date) = gs ${bc}
      ), 0)::text AS value
    FROM generate_series(DATE_TRUNC('week', NOW()::date - 27), DATE_TRUNC('week', NOW()::date), '1 week'::interval) gs
    ORDER BY gs
  `, { replacements: { orgId }, type: QueryTypes.SELECT })

  const annualRows = await sequelize.query<CashFlowRow>(`
    SELECT TO_CHAR(gs, 'Mon') AS label,
      COALESCE((
        SELECT SUM(CAST(i.total AS NUMERIC)) FROM invoices i
        WHERE i.org_id = :orgId AND i.deleted_at IS NULL
          AND i.status NOT IN ('draft','cancelled')
          AND DATE_TRUNC('month', i.issue_date) = gs ${bc}
      ), 0)::text AS value
    FROM generate_series(DATE_TRUNC('month', NOW() - INTERVAL '11 months'), DATE_TRUNC('month', NOW()), '1 month'::interval) gs
    ORDER BY gs
  `, { replacements: { orgId }, type: QueryTypes.SELECT })

  const toPoints = (rows: CashFlowRow[]) => rows.map(r => ({ label: r.label, value: parseFloat(r.value) }))

  return {
    semanal: toPoints(weeklyRows),
    mensual: toPoints(monthlyRows),
    anual: toPoints(annualRows),
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
      WHERE sm.org_id = :orgId AND sm.deleted_at IS NULL
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
