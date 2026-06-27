'use client'

import { Fragment, useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { StatusBadge } from '@/components/primitives/Badge'
import { Skeleton } from '@/components/primitives/Skeleton'
import { PerformanceCard, PanelBarChart, PanelDonutChart, Sparkline, KpiLabel, PanelWidgetProvider, PanelWidgetMenu, PanelWidgetSlot, usePanelWidgets, PanelAnalyticsCompareLabel, PanelAnalyticsRevenueSection, PanelAnalyticsOrdersSection, PanelAnalyticsProductsSection } from '@/components/erp'
import { withPanelTrendInfo } from '@/components/erp/panel-kpi-trend-info'
import type { BarChartDataPoint, DonutSegment, PerformanceSeriesPoint } from '@/components/erp'
import type { PanelAnalytics as PanelAnalyticsData } from '@/modules/panel/panel.types'
import type { PanelWidgetId } from '@/modules/panel/panel-widget.types'
import { DEFAULT_PANEL_WIDGET_ORDER } from '@/modules/panel/panel-widget.types'
import { fetchJson } from '@/lib/fetch-json'
import { PanelFilterBar, type PanelPeriod } from './PanelFilterBar'

// ── Types ───────────────────────────────────────────────────────────────────

interface StockAlerts {
  expired: number
  expiring_soon: number
  below_minimum: number
}

type Period = PanelPeriod

interface KpisData {
  kpis: {
    facturado: { value: number; pct_change: number; spark: number[] }
    cobrado:   { value: number; pct_change: number; spark: number[] }
    por_cobrar: { value: number; overdue_count: number }
    saldo_cuenta: null
  }
  counts: { productos: number; clientes: number; proveedores: number; comprobantes: number }
  cash_flow: { semanal: BarChartDataPoint[]; mensual: BarChartDataPoint[]; anual: BarChartDataPoint[] }
  gastos: DonutSegment[]
  performance_series: PerformanceSeriesPoint[]
  analytics: PanelAnalyticsData
}

interface RecentInvoice {
  numero: string
  cliente: string
  fecha: string
  total: string
  status: string
}

interface ActivityItem {
  type: string
  text: string
  time: string
}

// ── Constants ───────────────────────────────────────────────────────────────

const INVOICE_STATUS_MAP: Record<string, string> = {
  draft:          'Borrador',
  issued:         'Pendiente',
  partially_paid: 'En proceso',
  paid:           'Aprobado',
  cancelled:      'Anulado',
}

import { BRAND_CHART_COLOR } from '@/lib/brand-colors'

const DESKTOP_KPI_INFO = {
  facturado:
    'Total facturado en el período seleccionado. Incluye IVA. Excluye borradores y anulados.',
  cobrado:
    'Pagos registrados en el período, según fecha de cobro (no fecha de emisión de la factura).',
  por_cobrar:
    'Saldo pendiente de cobro en facturas emitidas o parcialmente pagadas. Incluye vencidas y al día.',
  saldo_cuenta: 'Saldo bancario/contable. Disponible cuando esté activo el módulo de contabilidad.',
} as const

const ars = (v: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v)

function getPeriodLabel(period: Period, fromDate: string, toDate: string): string {
  const now = new Date()
  const monthYear = now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  switch (period) {
    case 'last_week':
      return 'Última semana'
    case 'last_month':
      return `Este mes — ${cap(monthYear)}`
    case 'last_3months':
      return 'Últimos 3 meses'
    case 'last_year':
      return 'Último año'
    case 'custom':
      if (fromDate && toDate) {
        const from = new Date(fromDate).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
        const to = new Date(toDate).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
        return `${from} — ${to}`
      }
      return 'Período personalizado'
    default:
      return cap(monthYear)
  }
}

// ── Sub-components ──────────────────────────────────────────────────────────

function TrendBadge({ pct }: { pct: number }) {
  if (pct > 0) return <span className="text-[11px] font-medium text-success truncate block">↑ {pct}% vs período anterior</span>
  if (pct < 0) return <span className="text-[11px] font-medium text-danger truncate block">↓ {Math.abs(pct)}% vs período anterior</span>
  return <span className="text-[11px] text-fg-subtle truncate block">Sin variación</span>
}

function KPICard({
  label, info, value, sub, spark, sparkColor,
}: { label: string; info?: string; value: React.ReactNode; sub: React.ReactNode; spark?: number[]; sparkColor?: string }) {
  return (
    <div className="bg-surface border border-border rounded-[4px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 flex flex-col gap-2 min-w-0">
      <KpiLabel
        label={label}
        info={info}
        labelClassName="text-[11px] font-semibold text-fg-subtle uppercase tracking-[0.06em]"
      />
      <div className="flex items-end justify-between gap-2 min-w-0">
        <div className="font-mono text-lg sm:text-[22px] font-medium text-fg leading-none truncate">{value}</div>
        {spark && spark.length > 1 && (
          <Sparkline data={spark} color={sparkColor ?? BRAND_CHART_COLOR} />
        )}
      </div>
      <div className="min-w-0">{sub}</div>
    </div>
  )
}

function CountCard({ label, value, icon }: { label: string; value: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-[4px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 flex items-center gap-3 min-w-0">
      <div className="w-9 h-9 rounded-[4px] bg-brand-accent-bg flex items-center justify-center shrink-0 text-brand-accent">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="font-mono text-xl font-medium text-fg leading-none truncate">{value}</div>
        <div className="text-[11px] text-fg-muted mt-0.5 truncate">{label}</div>
      </div>
    </div>
  )
}

// ── Icons ───────────────────────────────────────────────────────────────────

const IconBox = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
)
const IconUsers = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)
const IconBuilding = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>
  </svg>
)
const IconFile = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
)

function ActivityIcon({ type }: { type: string }) {
  const stroke = 'currentColor'
  if (type === 'payment') {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    )
  }
  if (type === 'stock') {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      </svg>
    )
  }
  if (type === 'purchase') {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
      </svg>
    )
  }
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export function PanelClient({
  orgName = null,
  initialHiddenWidgets = [],
  initialWidgetOrder = DEFAULT_PANEL_WIDGET_ORDER,
  lockedBranchId = null,
}: {
  orgName?: string | null
  initialHiddenWidgets?: PanelWidgetId[]
  initialWidgetOrder?: PanelWidgetId[]
  lockedBranchId?: string | null
}) {
  return (
    <PanelWidgetProvider initialHidden={initialHiddenWidgets} initialOrder={initialWidgetOrder}>
      <PanelClientContent orgName={orgName} lockedBranchId={lockedBranchId} />
    </PanelWidgetProvider>
  )
}

function PanelClientContent({
  orgName = null,
  lockedBranchId = null,
}: {
  orgName?: string | null
  lockedBranchId?: string | null
}) {
  const { widgetOrder, isHidden } = usePanelWidgets()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const period = (searchParams.get('period') as Period) ?? 'last_month'
  const branchId = searchParams.get('branch_id') ?? 'all'
  const fromDate = searchParams.get('from') ?? ''
  const toDate = searchParams.get('to') ?? ''

  const [kpisData, setKpisData] = useState<KpisData | null>(null)
  const [invoices, setInvoices] = useState<RecentInvoice[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [cashView, setCashView] = useState<'semanal' | 'mensual' | 'anual'>('mensual')
  const [loading, setLoading] = useState(true)
  const [branches, setBranches] = useState<{ value: string; label: string }[]>([])
  const [stockAlerts, setStockAlerts] = useState<StockAlerts | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | undefined>()
  const [performanceSeries, setPerformanceSeries] = useState<PerformanceSeriesPoint[]>([])

  const updateParams = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([k, v]) => {
      if (v) params.set(k, v)
      else params.delete(k)
    })
    router.replace(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

  useEffect(() => {
    if (!lockedBranchId) return
    if (branchId !== lockedBranchId) {
      updateParams({ branch_id: lockedBranchId })
    }
  }, [lockedBranchId, branchId, updateParams])

  // Load stock alerts once (independent of period filter)
  useEffect(() => {
    Promise.all([
      fetchJson<{ total: number }>('/api/v1/inventory/stock?expired=true&limit=1'),
      fetchJson<{ total: number }>('/api/v1/inventory/stock?expiring_within_days=7&limit=1'),
      fetchJson<{ total: number }>('/api/v1/inventory/stock?below_minimum=true&limit=1'),
    ])
      .then(([exp, soon, low]) => {
        setStockAlerts({ expired: exp.total ?? 0, expiring_soon: soon.total ?? 0, below_minimum: low.total ?? 0 })
      })
      .catch(() => {})
  }, [])

  // Load branches once
  useEffect(() => {
    fetchJson<{ data: { id: string; name: string; branch_code: number }[] }>('/api/v1/branches')
      .then(res => {
        const list = res.data ?? []
        if (lockedBranchId) {
          const branch = list.find(b => b.id === lockedBranchId)
          setBranches(branch
            ? [{ value: branch.id, label: `${String(branch.branch_code).padStart(2, '0')} — ${branch.name}` }]
            : [])
          return
        }
        const opts = [
          { value: 'all', label: 'Todas las sucursales' },
          ...list.map(b => ({ value: b.id, label: `${String(b.branch_code).padStart(2, '0')} — ${b.name}` })),
        ]
        setBranches(opts)
      })
      .catch(() => setBranches(lockedBranchId ? [] : [{ value: 'all', label: 'Todas las sucursales' }]))
  }, [lockedBranchId])

  // Load dashboard data when filters change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setLoading before async fetch is intentional; avoids stale loading UI when filters change
    setLoading(true)
    const qs = new URLSearchParams({ period, branch_id: branchId })
    if (period === 'custom' && fromDate) qs.set('from', fromDate)
    if (period === 'custom' && toDate) qs.set('to', toDate)
    const q = qs.toString()

    Promise.all([
      fetchJson<KpisData>(`/api/v1/panel/kpis?${q}`),
      fetchJson<{ invoices: RecentInvoice[] }>(`/api/v1/panel/recent-invoices?${q}`),
      fetchJson<{ items: ActivityItem[] }>(`/api/v1/panel/activity?${q}`),
    ])
      .then(([kpis, inv, act]) => {
        setKpisData(kpis)
        setPerformanceSeries(kpis.performance_series ?? [])
        setInvoices(inv.invoices ?? [])
        setActivity(act.items ?? [])
        setLastUpdated(new Date())
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [period, branchId, fromDate, toDate])

  const kpis = kpisData?.kpis
  const counts = kpisData?.counts
  const cashFlow = kpisData?.cash_flow
  const gastos = useMemo(() => kpisData?.gastos ?? [], [kpisData?.gastos])

  const periodLabel = getPeriodLabel(period, fromDate, toDate)
  const comparePeriodLabel = kpisData?.analytics?.compare_period_label ?? ''
  const analytics = kpisData?.analytics ?? null

  const hasStockAlerts = stockAlerts !== null
    && (stockAlerts.expired > 0 || stockAlerts.expiring_soon > 0 || stockAlerts.below_minimum > 0)

  const widgetNodes = useMemo<Record<PanelWidgetId, React.ReactNode>>(() => ({
    performance: (
      <PanelWidgetSlot widgetId="performance">
        <PerformanceCard
          periodLabel={periodLabel}
          series={performanceSeries}
          facturado={kpis?.facturado.value ?? 0}
          cobrado={kpis?.cobrado.value ?? 0}
          porCobrar={kpis?.por_cobrar.value ?? 0}
          comprobantes={counts?.comprobantes ?? 0}
          clientes={counts?.clientes ?? 0}
          lastUpdated={lastUpdated}
          loading={loading}
          headerAction={<PanelWidgetMenu widgetId="performance" />}
        />
      </PanelWidgetSlot>
    ),
    analytics_revenue: (
      <PanelAnalyticsRevenueSection analytics={analytics} loading={loading} comparePeriodLabel={comparePeriodLabel} />
    ),
    analytics_orders: (
      <PanelAnalyticsOrdersSection analytics={analytics} loading={loading} comparePeriodLabel={comparePeriodLabel} />
    ),
    analytics_products: (
      <PanelAnalyticsProductsSection
        periodLabel={periodLabel}
        analytics={analytics}
        lastUpdated={lastUpdated}
        loading={loading}
        comparePeriodLabel={comparePeriodLabel}
      />
    ),
    kpi_cards: (
      <PanelWidgetSlot widgetId="kpi_cards">
        <div className="hidden xl:block">
          <div className="flex justify-end mb-1">
            <PanelWidgetMenu widgetId="kpi_cards" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KPICard
              label="Facturado"
              info={withPanelTrendInfo(DESKTOP_KPI_INFO.facturado, comparePeriodLabel)}
              value={kpis ? ars(kpis.facturado.value) : <Skeleton className="h-5 w-28" />}
              spark={kpis?.facturado.spark}
              sparkColor={kpis && kpis.facturado.pct_change >= 0 ? '#16A34A' : '#DC2626'}
              sub={kpis ? <TrendBadge pct={kpis.facturado.pct_change} /> : <Skeleton className="h-3 w-24" />}
            />
            <KPICard
              label="Cobrado"
              info={withPanelTrendInfo(DESKTOP_KPI_INFO.cobrado, comparePeriodLabel)}
              value={kpis ? ars(kpis.cobrado.value) : <Skeleton className="h-5 w-28" />}
              spark={kpis?.cobrado.spark}
              sparkColor={kpis && kpis.cobrado.pct_change >= 0 ? '#16A34A' : '#DC2626'}
              sub={kpis ? <TrendBadge pct={kpis.cobrado.pct_change} /> : <Skeleton className="h-3 w-24" />}
            />
            <KPICard
              label="Cuentas por cobrar"
              info={DESKTOP_KPI_INFO.por_cobrar}
              value={kpis ? ars(kpis.por_cobrar.value) : <Skeleton className="h-5 w-28" />}
              sub={
                kpis
                  ? kpis.por_cobrar.overdue_count > 0
                    ? <span className="text-[11px] font-medium text-warning">{kpis.por_cobrar.overdue_count} factura{kpis.por_cobrar.overdue_count > 1 ? 's' : ''} vencida{kpis.por_cobrar.overdue_count > 1 ? 's' : ''}</span>
                    : <span className="text-[11px] text-success">Al día</span>
                  : <Skeleton className="h-3 w-24" />
              }
            />
            <KPICard
              label="Saldo en cuenta"
              info={DESKTOP_KPI_INFO.saldo_cuenta}
              value="—"
              sub={<span className="text-[11px] text-fg-subtle line-clamp-2">Módulo contabilidad pendiente</span>}
            />
          </div>
        </div>
      </PanelWidgetSlot>
    ),
    counts: (
      <PanelWidgetSlot widgetId="counts">
        <div className="flex justify-end mb-1">
          <PanelWidgetMenu widgetId="counts" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <CountCard label="Productos activos" value={counts ? counts.productos.toLocaleString('es-AR') : <Skeleton className="h-5 w-12" />} icon={<IconBox />} />
          <CountCard label="Clientes"          value={counts ? counts.clientes.toLocaleString('es-AR') : <Skeleton className="h-5 w-12" />} icon={<IconUsers />} />
          <CountCard label="Proveedores"       value={counts ? counts.proveedores.toLocaleString('es-AR') : <Skeleton className="h-5 w-12" />} icon={<IconBuilding />} />
          <CountCard label="Comprobantes"      value={counts ? counts.comprobantes.toLocaleString('es-AR') : <Skeleton className="h-5 w-12" />} icon={<IconFile />} />
        </div>
      </PanelWidgetSlot>
    ),
    stock_alerts: hasStockAlerts ? (
      <PanelWidgetSlot widgetId="stock_alerts">
        <div className="flex justify-end mb-1">
          <PanelWidgetMenu widgetId="stock_alerts" />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {stockAlerts!.expired > 0 && (
            <Link href="/inventario/stock?expired=true" className="bg-danger-bg border border-danger rounded-[4px] p-4 flex items-center gap-3 hover:bg-danger-bg transition-colors">
              <div className="w-9 h-9 rounded-[4px] bg-danger-bg flex items-center justify-center shrink-0 text-danger">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <div className="font-mono text-xl font-medium text-danger leading-none">{stockAlerts!.expired}</div>
                <div className="text-[11px] text-danger mt-0.5">Producto{stockAlerts!.expired > 1 ? 's' : ''} vencido{stockAlerts!.expired > 1 ? 's' : ''}</div>
              </div>
            </Link>
          )}
          {stockAlerts!.expiring_soon > 0 && (
            <Link href="/inventario/stock?expiring_within_days=7" className="bg-warning-bg border border-warning rounded-[4px] p-4 flex items-center gap-3 hover:bg-warning-bg transition-colors">
              <div className="w-9 h-9 rounded-[4px] bg-warning-bg flex items-center justify-center shrink-0 text-warning">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div>
                <div className="font-mono text-xl font-medium text-warning leading-none">{stockAlerts!.expiring_soon}</div>
                <div className="text-[11px] text-warning mt-0.5">Vence{stockAlerts!.expiring_soon > 1 ? 'n' : ''} en 7 días</div>
              </div>
            </Link>
          )}
          {stockAlerts!.below_minimum > 0 && (
            <Link href="/inventario/stock?below_minimum=true" className="bg-orange-50 border border-orange-200 rounded-[4px] p-4 flex items-center gap-3 hover:bg-orange-100 transition-colors">
              <div className="w-9 h-9 rounded-[4px] bg-orange-100 flex items-center justify-center shrink-0 text-orange-600">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
                </svg>
              </div>
              <div>
                <div className="font-mono text-xl font-medium text-orange-700 leading-none">{stockAlerts!.below_minimum}</div>
                <div className="text-[11px] text-orange-600 mt-0.5">Bajo stock mínimo</div>
              </div>
            </Link>
          )}
        </div>
      </PanelWidgetSlot>
    ) : null,
    cash_flow: (
      <PanelWidgetSlot widgetId="cash_flow">
        <div className="hidden xl:block bg-surface border border-border rounded-[4px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
          <div className="flex items-center mb-4 gap-2">
            <span className="text-[13px] font-semibold text-fg">Flujo de caja</span>
            <div className="ml-auto flex items-center gap-1">
              {(['semanal', 'mensual', 'anual'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setCashView(v)}
                  className={`text-[11px] px-2.5 py-1 rounded-[4px] font-medium capitalize transition-colors ${
                    cashView === v
                      ? 'bg-brand-accent-bg text-brand-accent border border-brand-accent-border'
                      : 'text-fg-muted hover:bg-surface-hover border border-transparent'
                  }`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
              <PanelWidgetMenu widgetId="cash_flow" />
            </div>
          </div>
          {cashFlow ? (
            <PanelBarChart data={cashFlow[cashView]} color={BRAND_CHART_COLOR} />
          ) : (
            <Skeleton shape="block" className="h-40 w-full" />
          )}
        </div>
      </PanelWidgetSlot>
    ),
    gastos: (
      <PanelWidgetSlot widgetId="gastos">
        <div className="bg-surface border border-border rounded-[4px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
          <div className="flex items-center justify-between gap-2 mb-4">
            <span className="text-[13px] font-semibold text-fg">Gastos por proveedor</span>
            <PanelWidgetMenu widgetId="gastos" />
          </div>
          {gastos.length > 0 ? (
            <PanelDonutChart segments={gastos} />
          ) : loading ? (
            <Skeleton shape="block" className="h-40 w-full" />
          ) : (
            <div className="h-40 flex items-center justify-center text-sm text-fg-subtle">Sin datos de compras en el período</div>
          )}
        </div>
      </PanelWidgetSlot>
    ),
    recent_invoices: (
      <PanelWidgetSlot widgetId="recent_invoices">
        <div className="bg-surface border border-border rounded-[4px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <span className="text-[13px] font-semibold text-fg">Facturas recientes</span>
            <div className="ml-auto flex items-center gap-2">
              <Link href="/ventas/facturas" className="text-[12px] text-brand-accent hover:underline flex items-center gap-1">
                Ver todas
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
              <PanelWidgetMenu widgetId="recent_invoices" />
            </div>
          </div>
          {invoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-surface-muted">
                    {['Comprobante', 'Cliente', 'Fecha', 'Total', 'Estado'].map(h => (
                      <th key={h} className={`text-[11px] font-semibold text-fg-subtle px-3.5 py-2 border-b border-border uppercase tracking-[0.03em] ${h === 'Total' ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((row, i) => (
                    <tr key={i} className="hover:bg-surface-muted transition-colors border-b border-border last:border-0">
                      <td className="font-mono text-[12px] px-3.5 py-2.5 text-fg-muted">{row.numero}</td>
                      <td className="text-[13px] px-3.5 py-2.5 text-fg">{row.cliente}</td>
                      <td className="font-mono text-[12px] px-3.5 py-2.5 text-fg-subtle">{row.fecha}</td>
                      <td className="font-mono text-[13px] px-3.5 py-2.5 text-right font-medium text-fg">{row.total}</td>
                      <td className="px-3.5 py-2.5">
                        <StatusBadge value={INVOICE_STATUS_MAP[row.status] ?? row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : loading ? (
            <div className="flex flex-col gap-2.5 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-full" />
              ))}
            </div>
          ) : (
            <div className="p-6 text-sm text-fg-subtle text-center">Sin facturas en el período</div>
          )}
        </div>
      </PanelWidgetSlot>
    ),
    activity: (
      <PanelWidgetSlot widgetId="activity">
        <div className="bg-surface border border-border rounded-[4px] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-fg">Actividad reciente</span>
            <PanelWidgetMenu widgetId="activity" />
          </div>
          {activity.length > 0 ? (
            <div>
              {activity.map((item, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-2.5 border-b border-border last:border-0">
                  <div className="w-7 h-7 rounded-full bg-brand-accent-bg text-brand-accent flex items-center justify-center shrink-0 mt-0.5">
                    <ActivityIcon type={item.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-fg leading-snug">{item.text}</div>
                    <div className="text-[11px] text-fg-subtle mt-0.5">{item.time}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : loading ? (
            <div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-2.5 border-b border-border last:border-0">
                  <Skeleton shape="circle" className="h-7 w-7 shrink-0" />
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-2.5 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-sm text-fg-subtle text-center">Sin actividad reciente</div>
          )}
        </div>
      </PanelWidgetSlot>
    ),
  }), [
    periodLabel,
    comparePeriodLabel,
    performanceSeries,
    kpis,
    counts,
    lastUpdated,
    loading,
    analytics,
    stockAlerts,
    hasStockAlerts,
    cashFlow,
    cashView,
    gastos,
    invoices,
    activity,
  ])

  const firstVisibleAnalyticsId = widgetOrder.find(
    id => id.startsWith('analytics_') && !isHidden(id),
  )

  return (
    <div className="flex flex-col h-full" id="panel-dashboard">
      <TopBar breadcrumbs={[{ label: 'Panel' }]} />

      <PanelFilterBar
        period={period}
        branchId={branchId}
        fromDate={fromDate}
        toDate={toDate}
        branches={branches}
        branchLocked={!!lockedBranchId}
        onPeriodChange={p => updateParams({ period: p })}
        onBranchChange={id => updateParams({ branch_id: id })}
        onFromChange={from => updateParams({ from })}
        onToChange={to => updateParams({ to })}
      />

      <PageBody padding="p-4 md:p-6" className="bg-surface-muted print:bg-surface print:p-4">
        {orgName && (
          <header className="mb-5 md:mb-6 print:mb-4">
            <h1 className="text-[22px] md:text-[28px] font-semibold text-fg tracking-tight leading-tight">
              {orgName}
            </h1>
            <p className="text-[13px] text-fg-muted mt-1">
              Resumen de tu negocio
            </p>
          </header>
        )}
        {widgetOrder.map(id => {
          const node = widgetNodes[id]
          if (!node) return null

          const showCompare = id === firstVisibleAnalyticsId && comparePeriodLabel

          return (
            <Fragment key={id}>
              {showCompare ? (
                <div className="mb-4">
                  <PanelAnalyticsCompareLabel label={comparePeriodLabel} />
                </div>
              ) : null}
              <div className="mb-4">{node}</div>
            </Fragment>
          )
        })}
      </PageBody>
    </div>
  )
}
