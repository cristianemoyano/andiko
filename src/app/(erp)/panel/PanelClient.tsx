'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/primitives/Button'
import { StatusBadge } from '@/components/primitives/Badge'
import { Sparkline, PanelBarChart, PanelDonutChart } from '@/components/erp'
import { SearchableSelect } from '@/components/erp'
import { fetchJson } from '@/lib/fetch-json'
import type { BarChartDataPoint, DonutSegment } from '@/components/erp'

// ── Types ───────────────────────────────────────────────────────────────────

interface StockAlerts {
  expired: number
  expiring_soon: number
  below_minimum: number
}

type Period = 'last_week' | 'last_month' | 'last_3months' | 'last_year' | 'custom'

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

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'last_week',    label: 'Última semana' },
  { value: 'last_month',   label: 'Último mes' },
  { value: 'last_3months', label: 'Últimos 3 meses' },
  { value: 'last_year',    label: 'Último año' },
]

const INVOICE_STATUS_MAP: Record<string, string> = {
  draft:          'Borrador',
  issued:         'Pendiente',
  partially_paid: 'En proceso',
  paid:           'Aprobado',
  cancelled:      'Anulado',
}

const PRIMARY = '#0C647A'

const ars = (v: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v)

// ── Sub-components ──────────────────────────────────────────────────────────

function TrendBadge({ pct }: { pct: number }) {
  if (pct > 0) return <span className="text-[11px] font-medium text-success truncate block">↑ {pct}% vs período anterior</span>
  if (pct < 0) return <span className="text-[11px] font-medium text-danger truncate block">↓ {Math.abs(pct)}% vs período anterior</span>
  return <span className="text-[11px] text-fg-subtle truncate block">Sin variación</span>
}

function KPICard({
  label, value, sub, spark, sparkColor,
}: { label: string; value: string; sub: React.ReactNode; spark?: number[]; sparkColor?: string }) {
  return (
    <div className="bg-surface border border-border rounded-[4px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 flex flex-col gap-2 min-w-0">
      <div className="text-[11px] font-semibold text-fg-subtle uppercase tracking-[0.06em] truncate">{label}</div>
      <div className="flex items-end justify-between gap-2 min-w-0">
        <div className="font-mono text-lg sm:text-[22px] font-medium text-fg leading-none truncate">{value}</div>
        {spark && spark.length > 1 && (
          <Sparkline data={spark} color={sparkColor ?? PRIMARY} />
        )}
      </div>
      <div className="min-w-0">{sub}</div>
    </div>
  )
}

function CountCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-[4px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 flex items-center gap-3 min-w-0">
      <div className="w-9 h-9 rounded-[4px] bg-[#EEF8FA] flex items-center justify-center shrink-0 text-[#0C647A]">
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
  const stroke = '#0C647A'
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

export function PanelClient() {
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

  const updateParams = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([k, v]) => {
      if (v) params.set(k, v)
      else params.delete(k)
    })
    router.replace(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

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
        const opts = [
          { value: 'all', label: 'Todas las sucursales' },
          ...(res.data ?? []).map(b => ({ value: b.id, label: `${String(b.branch_code).padStart(2, '0')} — ${b.name}` })),
        ]
        setBranches(opts)
      })
      .catch(() => setBranches([{ value: 'all', label: 'Todas las sucursales' }]))
  }, [])

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
        setInvoices(inv.invoices ?? [])
        setActivity(act.items ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [period, branchId, fromDate, toDate])

  const kpis = kpisData?.kpis
  const counts = kpisData?.counts
  const cashFlow = kpisData?.cash_flow
  const gastos = kpisData?.gastos ?? []

  return (
    <div className="flex flex-col h-full" id="panel-dashboard">
      <TopBar breadcrumbs={[{ label: 'Panel' }]} />

      {/* Filter bar */}
      <div className="border-b border-border bg-surface px-4 md:px-6 py-2.5 flex flex-col gap-2 md:flex-row md:items-center md:gap-3 shrink-0 print:hidden">
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-1 w-max md:w-auto flex-nowrap">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => updateParams({ period: opt.value })}
              className={`text-xs px-3 py-1.5 rounded-[4px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                period === opt.value
                  ? 'bg-[#EEF8FA] text-[#0C647A] border border-[#A2DCE7]'
                  : 'text-fg-muted hover:bg-surface-hover border border-transparent'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            onClick={() => updateParams({ period: 'custom' })}
            className={`text-xs px-3 py-1.5 rounded-[4px] font-medium transition-colors whitespace-nowrap shrink-0 ${
              period === 'custom'
                ? 'bg-[#EEF8FA] text-[#0C647A] border border-[#A2DCE7]'
                : 'text-fg-muted hover:bg-surface-hover border border-transparent'
            }`}
          >
            Personalizado
          </button>
          </div>
        </div>

        {period === 'custom' && (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={fromDate}
              onChange={e => updateParams({ from: e.target.value })}
              className="text-xs border border-border rounded-[4px] px-2 py-1.5 text-fg-muted focus:outline-none focus:border-[#0C647A]"
            />
            <span className="text-xs text-fg-subtle">→</span>
            <input
              type="date"
              value={toDate}
              onChange={e => updateParams({ to: e.target.value })}
              className="text-xs border border-border rounded-[4px] px-2 py-1.5 text-fg-muted focus:outline-none focus:border-[#0C647A]"
            />
          </div>
        )}

        <div className="md:ml-auto flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="secondary"
            className="print:hidden"
            onClick={() => window.print()}
          >
            Exportar PDF
          </Button>
          <div className="w-full sm:w-52">
          {branches.length > 0 && (
            <SearchableSelect
              options={branches}
              value={branchId}
              onChange={v => updateParams({ branch_id: v ?? 'all' })}
              placeholder="Sucursal"
            />
          )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 bg-surface-muted print:bg-surface print:p-4">
        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
          <KPICard
            label="Facturado"
            value={kpis ? ars(kpis.facturado.value) : '—'}
            spark={kpis?.facturado.spark}
            sparkColor={kpis && kpis.facturado.pct_change >= 0 ? '#16A34A' : '#DC2626'}
            sub={kpis ? <TrendBadge pct={kpis.facturado.pct_change} /> : <span className="text-[11px] text-fg-subtle">Cargando…</span>}
          />
          <KPICard
            label="Cobrado"
            value={kpis ? ars(kpis.cobrado.value) : '—'}
            spark={kpis?.cobrado.spark}
            sparkColor={kpis && kpis.cobrado.pct_change >= 0 ? '#16A34A' : '#DC2626'}
            sub={kpis ? <TrendBadge pct={kpis.cobrado.pct_change} /> : <span className="text-[11px] text-fg-subtle">Cargando…</span>}
          />
          <KPICard
            label="Cuentas por cobrar"
            value={kpis ? ars(kpis.por_cobrar.value) : '—'}
            sub={
              kpis
                ? kpis.por_cobrar.overdue_count > 0
                  ? <span className="text-[11px] font-medium text-warning">{kpis.por_cobrar.overdue_count} factura{kpis.por_cobrar.overdue_count > 1 ? 's' : ''} vencida{kpis.por_cobrar.overdue_count > 1 ? 's' : ''}</span>
                  : <span className="text-[11px] text-success">Al día</span>
                : <span className="text-[11px] text-fg-subtle">Cargando…</span>
            }
          />
          <KPICard
            label="Saldo en cuenta"
            value="—"
            sub={<span className="text-[11px] text-fg-subtle line-clamp-2">Módulo contabilidad pendiente</span>}
          />
        </div>

        {/* Count cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
          <CountCard label="Productos activos" value={counts ? counts.productos.toLocaleString('es-AR') : '—'} icon={<IconBox />} />
          <CountCard label="Clientes"          value={counts ? counts.clientes.toLocaleString('es-AR') : '—'} icon={<IconUsers />} />
          <CountCard label="Proveedores"       value={counts ? counts.proveedores.toLocaleString('es-AR') : '—'} icon={<IconBuilding />} />
          <CountCard label="Comprobantes"      value={counts ? counts.comprobantes.toLocaleString('es-AR') : '—'} icon={<IconFile />} />
        </div>

        {/* Stock alerts */}
        {stockAlerts && (stockAlerts.expired > 0 || stockAlerts.expiring_soon > 0 || stockAlerts.below_minimum > 0) && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
            {stockAlerts.expired > 0 && (
              <Link href="/inventario/stock?expired=true" className="bg-danger-bg border border-danger rounded-[4px] p-4 flex items-center gap-3 hover:bg-danger-bg transition-colors">
                <div className="w-9 h-9 rounded-[4px] bg-danger-bg flex items-center justify-center shrink-0 text-danger">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </div>
                <div>
                  <div className="font-mono text-xl font-medium text-danger leading-none">{stockAlerts.expired}</div>
                  <div className="text-[11px] text-danger mt-0.5">Producto{stockAlerts.expired > 1 ? 's' : ''} vencido{stockAlerts.expired > 1 ? 's' : ''}</div>
                </div>
              </Link>
            )}
            {stockAlerts.expiring_soon > 0 && (
              <Link href="/inventario/stock?expiring_within_days=7" className="bg-warning-bg border border-warning rounded-[4px] p-4 flex items-center gap-3 hover:bg-warning-bg transition-colors">
                <div className="w-9 h-9 rounded-[4px] bg-warning-bg flex items-center justify-center shrink-0 text-warning">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                </div>
                <div>
                  <div className="font-mono text-xl font-medium text-warning leading-none">{stockAlerts.expiring_soon}</div>
                  <div className="text-[11px] text-warning mt-0.5">Vence{stockAlerts.expiring_soon > 1 ? 'n' : ''} en 7 días</div>
                </div>
              </Link>
            )}
            {stockAlerts.below_minimum > 0 && (
              <Link href="/inventario/stock?below_minimum=true" className="bg-orange-50 border border-orange-200 rounded-[4px] p-4 flex items-center gap-3 hover:bg-orange-100 transition-colors">
                <div className="w-9 h-9 rounded-[4px] bg-orange-100 flex items-center justify-center shrink-0 text-orange-600">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
                  </svg>
                </div>
                <div>
                  <div className="font-mono text-xl font-medium text-orange-700 leading-none">{stockAlerts.below_minimum}</div>
                  <div className="text-[11px] text-orange-600 mt-0.5">Bajo stock mínimo</div>
                </div>
              </Link>
            )}
          </div>
        )}

        {/* Charts row */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
          {/* Flujo de caja */}
          <div className="bg-surface border border-border rounded-[4px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
            <div className="flex items-center mb-4">
              <span className="text-[13px] font-semibold text-fg">Flujo de caja</span>
              <div className="ml-auto flex gap-1">
                {(['semanal', 'mensual', 'anual'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setCashView(v)}
                    className={`text-[11px] px-2.5 py-1 rounded-[4px] font-medium capitalize transition-colors ${
                      cashView === v
                        ? 'bg-[#EEF8FA] text-[#0C647A] border border-[#A2DCE7]'
                        : 'text-fg-muted hover:bg-surface-hover border border-transparent'
                    }`}
                  >
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {cashFlow ? (
              <PanelBarChart data={cashFlow[cashView]} color={PRIMARY} />
            ) : (
              <div className="h-40 flex items-center justify-center text-sm text-fg-subtle">Cargando…</div>
            )}
          </div>

          {/* Gastos por categoría */}
          <div className="bg-surface border border-border rounded-[4px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
            <div className="text-[13px] font-semibold text-fg mb-4">Gastos por proveedor</div>
            {gastos.length > 0 ? (
              <PanelDonutChart segments={gastos} />
            ) : loading ? (
              <div className="h-40 flex items-center justify-center text-sm text-fg-subtle">Cargando…</div>
            ) : (
              <div className="h-40 flex items-center justify-center text-sm text-fg-subtle">Sin datos de compras en el período</div>
            )}
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Recent invoices */}
          <div className="bg-surface border border-border rounded-[4px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center">
              <span className="text-[13px] font-semibold text-fg">Facturas recientes</span>
              <Link href="/ventas/facturas" className="ml-auto text-[12px] text-[#0C647A] hover:underline flex items-center gap-1">
                Ver todas
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
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
              <div className="p-6 text-sm text-fg-subtle text-center">Cargando…</div>
            ) : (
              <div className="p-6 text-sm text-fg-subtle text-center">Sin facturas en el período</div>
            )}
          </div>

          {/* Activity feed */}
          <div className="bg-surface border border-border rounded-[4px] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="px-4 py-3 border-b border-border">
              <span className="text-[13px] font-semibold text-fg">Actividad reciente</span>
            </div>
            {activity.length > 0 ? (
              <div>
                {activity.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-2.5 border-b border-border last:border-0">
                    <div className="w-7 h-7 rounded-full bg-[#D0EEF3] flex items-center justify-center shrink-0 mt-0.5">
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
              <div className="p-6 text-sm text-fg-subtle text-center">Cargando…</div>
            ) : (
              <div className="p-6 text-sm text-fg-subtle text-center">Sin actividad reciente</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
