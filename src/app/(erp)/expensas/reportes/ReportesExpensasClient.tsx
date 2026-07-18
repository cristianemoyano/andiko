'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, PanelBarChart, PanelDonutChart, type Column, type DonutSegment } from '@/components/erp'
import { Button } from '@/components/primitives/Button'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { DatePicker } from '@/components/primitives/DatePicker'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { toCsvText, type CsvHeader } from '@/lib/csv'

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

type AgingRow = {
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

type AgingTotals = Omit<AgingRow, 'contact_id' | 'legal_name' | 'trade_name' | 'cuit'>

type AgingResponse = {
  data: AgingRow[]
  totals: AgingTotals
  total: number
  page: number
  limit: number
  pages: number
}

const EMPTY_AGING_TOTALS: AgingTotals = {
  invoices_count: 0,
  current: '0.00',
  bucket_1_30: '0.00',
  bucket_31_60: '0.00',
  bucket_61_90: '0.00',
  bucket_90_plus: '0.00',
  balance: '0.00',
}

const DONUT_COLORS = ['#0C647A', '#0E7E9A', '#38A3BF', '#6EC9DF', '#A2DCE7', '#D0EEF3', '#F59E0B', '#EF4444']

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function exportAgingCsv(rows: AgingRow[], totals: AgingTotals) {
  const headers: CsvHeader[] = [
    { key: 'legal_name', label: 'Proveedor' },
    { key: 'cuit', label: 'CUIT' },
    { key: 'current', label: 'No vencido' },
    { key: 'bucket_1_30', label: '1-30 días' },
    { key: 'bucket_31_60', label: '31-60 días' },
    { key: 'bucket_61_90', label: '61-90 días' },
    { key: 'bucket_90_plus', label: '+90 días' },
    { key: 'balance', label: 'Saldo total' },
  ]
  const csvRows: Record<string, unknown>[] = [
    ...rows.map(r => ({
      legal_name: r.legal_name,
      cuit: r.cuit ?? '',
      current: r.current,
      bucket_1_30: r.bucket_1_30,
      bucket_31_60: r.bucket_31_60,
      bucket_61_90: r.bucket_61_90,
      bucket_90_plus: r.bucket_90_plus,
      balance: r.balance,
    })),
    {
      legal_name: 'Total',
      cuit: '',
      current: totals.current,
      bucket_1_30: totals.bucket_1_30,
      bucket_31_60: totals.bucket_31_60,
      bucket_61_90: totals.bucket_61_90,
      bucket_90_plus: totals.bucket_90_plus,
      balance: totals.balance,
    },
  ]
  const csv = toCsvText(csvRows, headers)
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `deuda-proveedores-expensas-aging-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function ReportesExpensasClient() {
  const [from, setFrom] = useState<Date | null>(startOfMonth())
  const [to, setTo] = useState<Date | null>(new Date())
  const [report, setReport] = useState<ReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [agingSearch, setAgingSearch] = useState('')
  const [agingRows, setAgingRows] = useState<AgingRow[]>([])
  const [agingTotals, setAgingTotals] = useState<AgingTotals>(EMPTY_AGING_TOTALS)
  const [agingError, setAgingError] = useState<string | null>(null)
  const [agingLoading, setAgingLoading] = useState(true)

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

  const loadAging = useCallback(async () => {
    const params = new URLSearchParams({ limit: '100' })
    if (agingSearch) params.set('search', agingSearch)
    setAgingLoading(true)
    try {
      const d = await fetchJson<AgingResponse>(`/api/v1/expenses/reports/aging?${params}`)
      setAgingRows(d.data ?? [])
      setAgingTotals(d.totals ?? EMPTY_AGING_TOTALS)
      setAgingError(null)
    } catch (e) {
      setAgingError(getApiErrorMessage(e))
      setAgingRows([])
      setAgingTotals(EMPTY_AGING_TOTALS)
    } finally {
      setAgingLoading(false)
    }
  }, [agingSearch])

  useEffect(() => {
    const t = setTimeout(() => { void loadAging() }, 0)
    return () => clearTimeout(t)
  }, [loadAging])

  const agingColumns = useMemo<Column<AgingRow>[]>(() => [
    {
      key: 'legal_name',
      header: 'Proveedor',
      render: row => (
        <div className="min-w-0">
          <span className="font-medium text-fg">{row.legal_name}</span>
          {row.trade_name ? <p className="truncate text-[12px] text-fg-muted">{row.trade_name}</p> : null}
        </div>
      ),
    },
    {
      key: 'current',
      header: 'No vencido',
      align: 'right',
      render: row => <span className="tabular-nums text-fg-muted">{formatARS(row.current)}</span>,
    },
    {
      key: 'bucket_1_30',
      header: '1-30 días',
      align: 'right',
      render: row => <span className="tabular-nums text-fg-muted">{formatARS(row.bucket_1_30)}</span>,
    },
    {
      key: 'bucket_31_60',
      header: '31-60 días',
      align: 'right',
      render: row => <span className="tabular-nums text-fg-muted">{formatARS(row.bucket_31_60)}</span>,
    },
    {
      key: 'bucket_61_90',
      header: '61-90 días',
      align: 'right',
      render: row => <span className="tabular-nums text-fg-muted">{formatARS(row.bucket_61_90)}</span>,
    },
    {
      key: 'bucket_90_plus',
      header: '+90 días',
      align: 'right',
      render: row => <span className="tabular-nums text-danger">{formatARS(row.bucket_90_plus)}</span>,
    },
    {
      key: 'balance',
      header: 'Saldo total',
      align: 'right',
      render: row => <span className="tabular-nums font-medium text-fg">{formatARS(row.balance)}</span>,
    },
  ], [])

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

          <section aria-label="Deuda por proveedor">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="max-w-2xl">
                <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide">Deuda por proveedor</p>
                <p className="text-[12px] text-fg-muted">
                  Cuánto le debés hoy a cada proveedor, separado según hace cuánto venció cada saldo:
                  <span className="text-fg-muted font-medium"> No vencido</span> (aún no llegó el vencimiento) y los tramos
                  de atraso <span className="text-fg-muted font-medium">1-30, 31-60, 61-90 y +90 días</span>. Cuanto más a la
                  derecha, más atrasada la deuda. Solo cuenta gastos confirmados con saldo pendiente y proveedor asignado.
                </p>
              </div>
              <span className="flex-1" />
              <input
                type="text"
                className="h-[30px] rounded-sm border border-border-strong bg-surface px-2 text-[13px] text-fg-muted focus:border-ring focus:outline-none"
                placeholder="Buscar proveedor o CUIT..."
                value={agingSearch}
                onChange={e => setAgingSearch(e.target.value)}
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => exportAgingCsv(agingRows, agingTotals)}
                disabled={agingRows.length === 0}
              >
                Exportar CSV
              </Button>
            </div>

            {agingError && <p className="mb-3 text-sm text-danger">{agingError}</p>}

            <DataTable
              columns={agingColumns}
              data={agingRows}
              keyExtractor={row => row.contact_id}
              emptyMessage={agingLoading ? 'Cargando…' : 'No hay proveedores con saldo pendiente.'}
              footer={
                agingRows.length > 0 ? (
                  <div className="flex items-center justify-between px-3 py-2 text-[13px] font-medium text-fg">
                    <span>Total</span>
                    <div className="flex items-center gap-6">
                      <span className="tabular-nums">No vencido {formatARS(agingTotals.current)}</span>
                      <span className="tabular-nums">1-30 {formatARS(agingTotals.bucket_1_30)}</span>
                      <span className="tabular-nums">31-60 {formatARS(agingTotals.bucket_31_60)}</span>
                      <span className="tabular-nums">61-90 {formatARS(agingTotals.bucket_61_90)}</span>
                      <span className="tabular-nums">+90 {formatARS(agingTotals.bucket_90_plus)}</span>
                      <span className="tabular-nums">Saldo {formatARS(agingTotals.balance)}</span>
                    </div>
                  </div>
                ) : undefined
              }
            />
          </section>
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
