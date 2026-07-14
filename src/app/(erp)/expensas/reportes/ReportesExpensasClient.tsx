'use client'

import { useEffect, useMemo, useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { PanelBarChart, PanelDonutChart, type DonutSegment } from '@/components/erp'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { DatePicker } from '@/components/primitives/DatePicker'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

type ReportResponse = {
  summary: {
    total: number
    tax_amount: number
    open_balance: number
    overdue_count: number
    count: number
  }
  by_kind: Array<{ kind: string; label: string; total: number; count: number }>
  by_period: Array<{ label: string; total: number }>
  by_supplier: Array<{ label: string; total: number }>
}

const DONUT_COLORS = ['#0C647A', '#0E7E9A', '#38A3BF', '#6EC9DF', '#A2DCE7', '#D0EEF3', '#F59E0B', '#EF4444']

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function ReportesExpensasClient() {
  const [from, setFrom] = useState<Date | null>(startOfMonth())
  const [to, setTo] = useState<Date | null>(new Date())
  const [report, setReport] = useState<ReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams()
    if (from) params.set('from', from.toISOString())
    if (to) params.set('to', to.toISOString())
    ;(async () => {
      setLoading(true)
      try {
        const data = await fetchJson<ReportResponse>(`/api/v1/expenses/reports?${params}`, {
          signal: controller.signal,
        })
        setReport(data)
        setError(null)
      } catch (e) {
        if (controller.signal.aborted) return
        setError(getApiErrorMessage(e))
        setReport(null)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    })()
    return () => { controller.abort() }
  }, [from, to])

  const kindSegments: DonutSegment[] = useMemo(
    () => (report?.by_kind ?? []).map((r, i) => ({
      label: `${r.label} (${r.count})`,
      value: r.total,
      color: DONUT_COLORS[i] ?? '#A2DCE7',
    })),
    [report],
  )

  const supplierSegments: DonutSegment[] = useMemo(
    () => (report?.by_supplier ?? []).map((r, i) => ({
      label: r.label,
      value: r.total,
      color: DONUT_COLORS[i] ?? '#A2DCE7',
    })),
    [report],
  )

  const periodBars = useMemo(
    () => (report?.by_period ?? []).map(r => ({ label: r.label, value: r.total })),
    [report],
  )

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Expensas', href: '/expensas' },
          { label: 'Reportes' },
        ]}
      />

      <PageBody>
        <div className="flex flex-col gap-5 max-w-6xl">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-1">Desde</p>
              <DatePicker value={from} onChange={setFrom} />
            </div>
            <div className="w-40">
              <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-1">Hasta</p>
              <DatePicker value={to} onChange={setTo} />
            </div>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <SummaryCard
              label="Gastado en el período"
              value={loading || !report ? '—' : formatARS(report.summary.total)}
              hint={report ? `${report.summary.count} comprobante${report.summary.count === 1 ? '' : 's'}` : undefined}
            />
            <SummaryCard
              label="IVA crédito"
              value={loading || !report ? '—' : formatARS(report.summary.tax_amount)}
            />
            <SummaryCard
              label="Saldo pendiente"
              value={loading || !report ? '—' : formatARS(report.summary.open_balance)}
              hint={
                report && report.summary.overdue_count > 0
                  ? `${report.summary.overdue_count} vencido${report.summary.overdue_count > 1 ? 's' : ''}`
                  : 'Al día'
              }
              hintDanger={!!report && report.summary.overdue_count > 0}
            />
            <SummaryCard
              label="Tipos activos"
              value={loading || !report ? '—' : String(report.by_kind.length)}
              hint="Único · Recurrente · Plan"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Distribución por tipo">
              {loading ? (
                <p className="text-sm text-fg-subtle">Cargando…</p>
              ) : kindSegments.length > 0 ? (
                <PanelDonutChart segments={kindSegments} />
              ) : (
                <p className="text-sm text-fg-subtle">Sin gastos en el período.</p>
              )}
            </ChartCard>

            <ChartCard title="Top proveedores">
              {loading ? (
                <p className="text-sm text-fg-subtle">Cargando…</p>
              ) : supplierSegments.length > 0 ? (
                <PanelDonutChart segments={supplierSegments} />
              ) : (
                <p className="text-sm text-fg-subtle">Sin gastos en el período.</p>
              )}
            </ChartCard>
          </div>

          <ChartCard title="Evolución mensual">
            {loading ? (
              <p className="text-sm text-fg-subtle">Cargando…</p>
            ) : periodBars.length > 0 ? (
              <PanelBarChart data={periodBars} />
            ) : (
              <p className="text-sm text-fg-subtle">Sin gastos en el período.</p>
            )}
          </ChartCard>
        </div>
      </PageBody>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  hint,
  hintDanger,
}: {
  label: string
  value: string
  hint?: string
  hintDanger?: boolean
}) {
  return (
    <div className="bg-surface border border-border rounded-sm px-4 py-3">
      <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide">{label}</p>
      <p className="text-[18px] font-semibold text-fg tabular-nums mt-1">{value}</p>
      {hint && (
        <p className={`text-[11px] mt-1 ${hintDanger ? 'text-warning font-medium' : 'text-fg-muted'}`}>{hint}</p>
      )}
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-sm p-5">
      <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide mb-4">{title}</p>
      {children}
    </div>
  )
}
