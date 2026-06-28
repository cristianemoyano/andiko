'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, PanelBarChart, type Column } from '@/components/erp'
import { Button } from '@/components/primitives/Button'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { VentasSubNav } from '../VentasSubNav'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { toCsvText, type CsvHeader } from '@/lib/csv'

type GroupBy = 'period' | 'customer' | 'product'
type Granularity = 'day' | 'week' | 'month'

type ReportRow = {
  group_key: string
  label: string
  secondary_label: string | null
  documents: number
  quantity: string | null
  subtotal: string
  tax: string
  total: string
}

type ReportTotals = {
  documents: number
  quantity: string | null
  subtotal: string
  tax: string
  total: string
}

type ReportResponse = {
  group_by: GroupBy
  granularity: Granularity
  data: ReportRow[]
  totals: ReportTotals
  truncated: boolean
}

const EMPTY_TOTALS: ReportTotals = { documents: 0, quantity: null, subtotal: '0.00', tax: '0.00', total: '0.00' }

const GROUP_BY_OPTIONS: Array<{ value: GroupBy; label: string }> = [
  { value: 'period', label: 'Por período' },
  { value: 'customer', label: 'Por cliente' },
  { value: 'product', label: 'Por producto' },
]

const GRANULARITY_OPTIONS: Array<{ value: Granularity; label: string }> = [
  { value: 'day', label: 'Por día' },
  { value: 'week', label: 'Por semana' },
  { value: 'month', label: 'Por mes' },
]

const GROUP_LABEL: Record<GroupBy, string> = {
  period: 'Período',
  customer: 'Cliente',
  product: 'Producto',
}

function parseGroupBy(value: string | null): GroupBy {
  return value === 'customer' || value === 'product' ? value : 'period'
}

function parseGranularity(value: string | null): Granularity {
  return value === 'day' || value === 'week' ? value : 'month'
}

function exportCsv(rows: ReportRow[], totals: ReportTotals, groupBy: GroupBy) {
  const headers: CsvHeader[] = [
    { key: 'label', label: GROUP_LABEL[groupBy] },
    ...(groupBy === 'product' ? [{ key: 'quantity', label: 'Cantidad' } as CsvHeader] : []),
    { key: 'documents', label: 'Comprobantes' },
    { key: 'subtotal', label: 'Subtotal' },
    { key: 'tax', label: 'IVA' },
    { key: 'total', label: 'Total' },
  ]
  const csvRows: Record<string, unknown>[] = [
    ...rows.map(r => ({
      label: r.label,
      quantity: r.quantity ?? '',
      documents: r.documents,
      subtotal: r.subtotal,
      tax: r.tax,
      total: r.total,
    })),
    {
      label: 'Total',
      quantity: totals.quantity ?? '',
      documents: totals.documents,
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
    },
  ]
  const csv = toCsvText(csvRows, headers)
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `reporte-ventas-${groupBy}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export interface VentasReportesClientProps {
  subnav?: ReactNode
  breadcrumbs?: { label: string; href?: string }[]
}

export function VentasReportesClient({
  subnav = <VentasSubNav />,
  breadcrumbs = [{ label: 'Ventas', href: '/ventas' }, { label: 'Reportes' }],
}: VentasReportesClientProps = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [groupBy, setGroupBy] = useState<GroupBy>(() => parseGroupBy(searchParams.get('group_by')))
  const [granularity, setGranularity] = useState<Granularity>(() => parseGranularity(searchParams.get('granularity')))
  const [fromDate, setFromDate] = useState(() => searchParams.get('from') ?? '')
  const [toDate, setToDate] = useState(() => searchParams.get('to') ?? '')

  const [rows, setRows] = useState<ReportRow[]>([])
  const [totals, setTotals] = useState<ReportTotals>(EMPTY_TOTALS)
  const [truncated, setTruncated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams()
    if (groupBy !== 'period') params.set('group_by', groupBy)
    if (groupBy === 'period' && granularity !== 'month') params.set('granularity', granularity)
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [groupBy, granularity, fromDate, toDate, pathname, router])

  const loadReport = useCallback(async () => {
    const params = new URLSearchParams({ group_by: groupBy })
    if (groupBy === 'period') params.set('granularity', granularity)
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    setLoading(true)
    try {
      const d = await fetchJson<ReportResponse>(`/api/v1/sales/reports?${params}`)
      setRows(d.data ?? [])
      setTotals(d.totals ?? EMPTY_TOTALS)
      setTruncated(d.truncated ?? false)
      setError(null)
    } catch (e) {
      setError(getApiErrorMessage(e))
      setRows([])
      setTotals(EMPTY_TOTALS)
      setTruncated(false)
    } finally {
      setLoading(false)
    }
  }, [groupBy, granularity, fromDate, toDate])

  useEffect(() => {
    const t = setTimeout(() => { void loadReport() }, 0)
    return () => clearTimeout(t)
  }, [loadReport])

  const columns = useMemo<Column<ReportRow>[]>(() => {
    const cols: Column<ReportRow>[] = [
      {
        key: 'label',
        header: GROUP_LABEL[groupBy],
        render: row => (
          <div className="min-w-0">
            <span className="font-medium text-fg">{row.label}</span>
            {row.secondary_label ? (
              <p className="truncate text-[12px] text-fg-muted">{row.secondary_label}</p>
            ) : null}
          </div>
        ),
      },
    ]
    if (groupBy === 'product') {
      cols.push({
        key: 'quantity',
        header: 'Cantidad',
        align: 'right',
        render: row => (
          <span className="tabular-nums text-fg-muted">{row.quantity ?? '—'}</span>
        ),
      })
    }
    cols.push(
      {
        key: 'documents',
        header: 'Comprobantes',
        align: 'right',
        render: row => <span className="tabular-nums text-fg-muted">{row.documents}</span>,
      },
      {
        key: 'subtotal',
        header: 'Subtotal',
        align: 'right',
        render: row => <span className="tabular-nums text-fg-muted">{formatARS(row.subtotal)}</span>,
      },
      {
        key: 'tax',
        header: 'IVA',
        align: 'right',
        render: row => <span className="tabular-nums text-fg-muted">{formatARS(row.tax)}</span>,
      },
      {
        key: 'total',
        header: 'Total',
        align: 'right',
        render: row => <span className="tabular-nums font-medium text-fg">{formatARS(row.total)}</span>,
      },
    )
    return cols
  }, [groupBy])

  const chartData = useMemo(
    () => rows.map(r => ({ label: r.label, value: Number(r.total) })),
    [rows],
  )

  return (
    <div className="flex h-full flex-col">
      <TopBar
        breadcrumbs={breadcrumbs}
        actions={
          <Button size="sm" variant="secondary" onClick={() => exportCsv(rows, totals, groupBy)} disabled={rows.length === 0}>
            Exportar CSV
          </Button>
        }
      />
      {subnav}

      <PageBody>
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        {truncated && (
          <p className="mb-3 text-sm text-warning">
            El reporte superó el límite de grupos. Acotá el rango de fechas para ver todos los resultados.
          </p>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-sm border border-border-strong bg-surface p-0.5" role="group" aria-label="Agrupar por">
            {GROUP_BY_OPTIONS.map(option => (
              <Button
                key={option.value}
                type="button"
                size="xs"
                variant="ghost"
                aria-pressed={groupBy === option.value}
                className={groupBy === option.value
                  ? 'bg-brand-600 text-white hover:bg-brand-600 hover:text-white'
                  : ''}
                onClick={() => setGroupBy(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          {groupBy === 'period' && (
            <select
              className="h-[30px] rounded-sm border border-border-strong bg-surface px-2 text-[13px] text-fg-muted focus:border-ring focus:outline-none"
              value={granularity}
              onChange={e => setGranularity(e.target.value as Granularity)}
              aria-label="Granularidad"
            >
              {GRANULARITY_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          )}

          <label className="flex items-center gap-1 text-[12px] text-fg-muted">
            Desde
            <input
              type="date"
              className="h-[30px] rounded-sm border border-border-strong bg-surface px-2 text-[13px] text-fg-muted focus:border-ring focus:outline-none"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-1 text-[12px] text-fg-muted">
            Hasta
            <input
              type="date"
              className="h-[30px] rounded-sm border border-border-strong bg-surface px-2 text-[13px] text-fg-muted focus:border-ring focus:outline-none"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
            />
          </label>

          <span className="flex-1" />
          <span className="text-[12px] text-fg-muted">
            {totals.documents} comprobante{totals.documents !== 1 ? 's' : ''}
          </span>
        </div>

        {groupBy === 'period' && rows.length > 0 && (
          <div className="mb-4 rounded border border-border bg-surface p-4">
            <p className="mb-2 text-[12px] uppercase tracking-wide text-fg-muted">Ventas por período</p>
            <PanelBarChart data={chartData} />
          </div>
        )}

        <DataTable
          columns={columns}
          data={rows}
          keyExtractor={row => row.group_key}
          emptyMessage={loading ? 'Cargando…' : 'No hay ventas para los filtros seleccionados.'}
          footer={
            rows.length > 0 ? (
              <div className="flex items-center justify-between px-3 py-2 text-[13px] font-medium text-fg">
                <span>Total</span>
                <div className="flex items-center gap-6">
                  {groupBy === 'product' && totals.quantity ? (
                    <span className="tabular-nums">Cant. {totals.quantity}</span>
                  ) : null}
                  <span className="tabular-nums">{totals.documents} comp.</span>
                  <span className="tabular-nums">Subtotal {formatARS(totals.subtotal)}</span>
                  <span className="tabular-nums">IVA {formatARS(totals.tax)}</span>
                  <span className="tabular-nums">Total {formatARS(totals.total)}</span>
                </div>
              </div>
            ) : undefined
          }
        />
      </PageBody>
    </div>
  )
}
