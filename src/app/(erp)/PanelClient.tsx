'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { StatusBadge } from '@/components/primitives/Badge'
import { Sparkline, PanelBarChart, PanelDonutChart } from '@/components/erp'
import { SearchableSelect } from '@/components/erp'
import { fetchJson } from '@/lib/fetch-json'
import type { BarChartDataPoint, DonutSegment } from '@/components/erp'

// ── Types ───────────────────────────────────────────────────────────────────

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
  if (pct > 0) return <span className="text-[11px] font-medium text-green-700">↑ {pct}% vs período anterior</span>
  if (pct < 0) return <span className="text-[11px] font-medium text-red-600">↓ {Math.abs(pct)}% vs período anterior</span>
  return <span className="text-[11px] text-zinc-400">Sin variación</span>
}

function KPICard({
  label, value, sub, spark, sparkColor,
}: { label: string; value: string; sub: React.ReactNode; spark?: number[]; sparkColor?: string }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-[4px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 flex flex-col gap-2">
      <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-[0.06em]">{label}</div>
      <div className="flex items-end justify-between">
        <div className="font-mono text-[22px] font-medium text-zinc-900 leading-none">{value}</div>
        {spark && spark.length > 1 && (
          <Sparkline data={spark} color={sparkColor ?? PRIMARY} />
        )}
      </div>
      <div>{sub}</div>
    </div>
  )
}

function CountCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-[4px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-[4px] bg-[#EEF8FA] flex items-center justify-center shrink-0 text-[#0C647A]">
        {icon}
      </div>
      <div>
        <div className="font-mono text-xl font-medium text-zinc-900 leading-none">{value}</div>
        <div className="text-[11px] text-zinc-500 mt-0.5">{label}</div>
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

  const updateParams = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([k, v]) => {
      if (v) params.set(k, v)
      else params.delete(k)
    })
    router.replace(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

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
    <div className="flex flex-col h-full">
      <TopBar breadcrumbs={[{ label: 'Panel' }]} />

      {/* Filter bar */}
      <div className="border-b border-zinc-200 bg-white px-6 py-2.5 flex items-center gap-3 shrink-0">
        <div className="flex gap-1">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => updateParams({ period: opt.value })}
              className={`text-xs px-3 py-1.5 rounded-[4px] font-medium transition-colors ${
                period === opt.value
                  ? 'bg-[#EEF8FA] text-[#0C647A] border border-[#A2DCE7]'
                  : 'text-zinc-500 hover:bg-zinc-100 border border-transparent'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            onClick={() => updateParams({ period: 'custom' })}
            className={`text-xs px-3 py-1.5 rounded-[4px] font-medium transition-colors ${
              period === 'custom'
                ? 'bg-[#EEF8FA] text-[#0C647A] border border-[#A2DCE7]'
                : 'text-zinc-500 hover:bg-zinc-100 border border-transparent'
            }`}
          >
            Personalizado
          </button>
        </div>

        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={e => updateParams({ from: e.target.value })}
              className="text-xs border border-zinc-200 rounded-[4px] px-2 py-1.5 text-zinc-700 focus:outline-none focus:border-[#0C647A]"
            />
            <span className="text-xs text-zinc-400">→</span>
            <input
              type="date"
              value={toDate}
              onChange={e => updateParams({ to: e.target.value })}
              className="text-xs border border-zinc-200 rounded-[4px] px-2 py-1.5 text-zinc-700 focus:outline-none focus:border-[#0C647A]"
            />
          </div>
        )}

        <div className="ml-auto w-52">
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

      <div className="flex-1 overflow-auto p-6 bg-zinc-50">
        {/* KPI cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
          <KPICard
            label="Facturado"
            value={kpis ? ars(kpis.facturado.value) : '—'}
            spark={kpis?.facturado.spark}
            sparkColor={kpis && kpis.facturado.pct_change >= 0 ? '#16A34A' : '#DC2626'}
            sub={kpis ? <TrendBadge pct={kpis.facturado.pct_change} /> : <span className="text-[11px] text-zinc-300">Cargando…</span>}
          />
          <KPICard
            label="Cobrado"
            value={kpis ? ars(kpis.cobrado.value) : '—'}
            spark={kpis?.cobrado.spark}
            sparkColor={kpis && kpis.cobrado.pct_change >= 0 ? '#16A34A' : '#DC2626'}
            sub={kpis ? <TrendBadge pct={kpis.cobrado.pct_change} /> : <span className="text-[11px] text-zinc-300">Cargando…</span>}
          />
          <KPICard
            label="Cuentas por cobrar"
            value={kpis ? ars(kpis.por_cobrar.value) : '—'}
            sub={
              kpis
                ? kpis.por_cobrar.overdue_count > 0
                  ? <span className="text-[11px] font-medium text-amber-700">{kpis.por_cobrar.overdue_count} factura{kpis.por_cobrar.overdue_count > 1 ? 's' : ''} vencida{kpis.por_cobrar.overdue_count > 1 ? 's' : ''}</span>
                  : <span className="text-[11px] text-green-700">Al día</span>
                : <span className="text-[11px] text-zinc-300">Cargando…</span>
            }
          />
          <KPICard
            label="Saldo en cuenta"
            value="—"
            sub={<span className="text-[11px] text-zinc-400">Módulo contabilidad pendiente</span>}
          />
        </div>

        {/* Count cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
          <CountCard label="Productos activos" value={counts ? counts.productos.toLocaleString('es-AR') : '—'} icon={<IconBox />} />
          <CountCard label="Clientes"          value={counts ? counts.clientes.toLocaleString('es-AR') : '—'} icon={<IconUsers />} />
          <CountCard label="Proveedores"       value={counts ? counts.proveedores.toLocaleString('es-AR') : '—'} icon={<IconBuilding />} />
          <CountCard label="Comprobantes"      value={counts ? counts.comprobantes.toLocaleString('es-AR') : '—'} icon={<IconFile />} />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
          {/* Flujo de caja */}
          <div className="bg-white border border-zinc-200 rounded-[4px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
            <div className="flex items-center mb-4">
              <span className="text-[13px] font-semibold text-zinc-900">Flujo de caja</span>
              <div className="ml-auto flex gap-1">
                {(['semanal', 'mensual', 'anual'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setCashView(v)}
                    className={`text-[11px] px-2.5 py-1 rounded-[4px] font-medium capitalize transition-colors ${
                      cashView === v
                        ? 'bg-[#EEF8FA] text-[#0C647A] border border-[#A2DCE7]'
                        : 'text-zinc-500 hover:bg-zinc-100 border border-transparent'
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
              <div className="h-40 flex items-center justify-center text-sm text-zinc-300">Cargando…</div>
            )}
          </div>

          {/* Gastos por categoría */}
          <div className="bg-white border border-zinc-200 rounded-[4px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
            <div className="text-[13px] font-semibold text-zinc-900 mb-4">Gastos por proveedor</div>
            {gastos.length > 0 ? (
              <PanelDonutChart segments={gastos} />
            ) : loading ? (
              <div className="h-40 flex items-center justify-center text-sm text-zinc-300">Cargando…</div>
            ) : (
              <div className="h-40 flex items-center justify-center text-sm text-zinc-400">Sin datos de compras en el período</div>
            )}
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Recent invoices */}
          <div className="bg-white border border-zinc-200 rounded-[4px] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="px-4 py-3 border-b border-zinc-100 flex items-center">
              <span className="text-[13px] font-semibold text-zinc-900">Facturas recientes</span>
              <Link href="/ventas/facturas" className="ml-auto text-[12px] text-[#0C647A] hover:underline flex items-center gap-1">
                Ver todas
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            </div>
            {invoices.length > 0 ? (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-zinc-50">
                    {['Comprobante', 'Cliente', 'Fecha', 'Total', 'Estado'].map(h => (
                      <th key={h} className={`text-[11px] font-semibold text-zinc-400 px-3.5 py-2 border-b border-zinc-100 uppercase tracking-[0.03em] ${h === 'Total' ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((row, i) => (
                    <tr key={i} className="hover:bg-zinc-50 transition-colors border-b border-zinc-50 last:border-0">
                      <td className="font-mono text-[12px] px-3.5 py-2.5 text-zinc-500">{row.numero}</td>
                      <td className="text-[13px] px-3.5 py-2.5 text-zinc-900">{row.cliente}</td>
                      <td className="font-mono text-[12px] px-3.5 py-2.5 text-zinc-400">{row.fecha}</td>
                      <td className="font-mono text-[13px] px-3.5 py-2.5 text-right font-medium text-zinc-900">{row.total}</td>
                      <td className="px-3.5 py-2.5">
                        <StatusBadge value={INVOICE_STATUS_MAP[row.status] ?? row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : loading ? (
              <div className="p-6 text-sm text-zinc-300 text-center">Cargando…</div>
            ) : (
              <div className="p-6 text-sm text-zinc-400 text-center">Sin facturas en el período</div>
            )}
          </div>

          {/* Activity feed */}
          <div className="bg-white border border-zinc-200 rounded-[4px] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="px-4 py-3 border-b border-zinc-100">
              <span className="text-[13px] font-semibold text-zinc-900">Actividad reciente</span>
            </div>
            {activity.length > 0 ? (
              <div>
                {activity.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-2.5 border-b border-zinc-50 last:border-0">
                    <div className="w-7 h-7 rounded-full bg-[#D0EEF3] flex items-center justify-center shrink-0 mt-0.5">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0C647A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] text-zinc-800 leading-snug">{item.text}</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">{item.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : loading ? (
              <div className="p-6 text-sm text-zinc-300 text-center">Cargando…</div>
            ) : (
              <div className="p-6 text-sm text-zinc-400 text-center">Sin actividad reciente</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
