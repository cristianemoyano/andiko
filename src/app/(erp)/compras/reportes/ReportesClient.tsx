'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, PanelBarChart, type Column } from '@/components/erp'
import { Button } from '@/components/primitives/Button'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { ComprasSubNav } from '../ComprasSubNav'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { toCsvText, type CsvHeader } from '@/lib/csv'

type GroupBy = 'period' | 'supplier' | 'category'
type Granularity = 'day' | 'week' | 'month'

type ReportRow = {
  key: string
  label: string
  count: number
  subtotal: string
  tax_amount: string
  total: string
}

type ReportTotals = {
  count: number
  subtotal: string
  tax_amount: string
  total: string
}

type ReportResponse = {
  group_by: GroupBy
  granularity: Granularity
  rows: ReportRow[]
  totals: ReportTotals
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

const EMPTY_TOTALS: ReportTotals = { count: 0, subtotal: '0.00', tax_amount: '0.00', total: '0.00' }

const EMPTY_AGING_TOTALS: AgingTotals = {
  invoices_count: 0,
  current: '0.00',
  bucket_1_30: '0.00',
  bucket_31_60: '0.00',
  bucket_61_90: '0.00',
  bucket_90_plus: '0.00',
  balance: '0.00',
}

const GROUP_BY_OPTIONS: Array<{ value: GroupBy; label: string }> = [
  { value: 'period',   label: 'Por período' },
  { value: 'supplier', label: 'Por proveedor' },
  { value: 'category', label: 'Por categoría' },
]

const REPORT_VIEW_OPTIONS: Array<{ value: 'compras' | 'deudas'; label: string }> = [
  { value: 'compras', label: 'Compras' },
  { value: 'deudas', label: 'Deudas con proveedores' },
]

const GRANULARITY_OPTIONS: Array<{ value: Granularity; label: string }> = [
  { value: 'day',   label: 'Por día' },
  { value: 'week',  label: 'Por semana' },
  { value: 'month', label: 'Por mes' },
]

const GROUP_LABEL: Record<GroupBy, string> = {
  period:   'Período',
  supplier: 'Proveedor',
  category: 'Categoría',
}

function parseGroupBy(value: string | null): GroupBy {
  return value === 'supplier' || value === 'category' ? value : 'period'
}

function parseGranularity(value: string | null): Granularity {
  return value === 'day' || value === 'week' ? value : 'month'
}

function exportCsv(rows: ReportRow[], totals: ReportTotals, groupBy: GroupBy) {
  const headers: CsvHeader[] = [
    { key: 'label',      label: GROUP_LABEL[groupBy] },
    { key: 'count',      label: 'Comprobantes' },
    { key: 'subtotal',   label: 'Subtotal' },
    { key: 'tax_amount', label: 'IVA' },
    { key: 'total',      label: 'Total' },
  ]
  const csvRows: Record<string, unknown>[] = [
    ...rows.map(r => ({
      label: r.label,
      count: r.count,
      subtotal: r.subtotal,
      tax_amount: r.tax_amount,
      total: r.total,
    })),
    { label: 'Total', count: totals.count, subtotal: totals.subtotal, tax_amount: totals.tax_amount, total: totals.total },
  ]
  const csv = toCsvText(csvRows, headers)
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `reporte-compras-${groupBy}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
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
  a.download = `reporte-deudas-proveedores-aging-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export interface ComprasReportesClientProps {
  subnav?: ReactNode
  breadcrumbs?: { label: string; href?: string }[]
}

export function ComprasReportesClient({
  subnav = <ComprasSubNav />,
  breadcrumbs = [{ label: 'Compras', href: '/compras' }, { label: 'Reportes' }],
}: ComprasReportesClientProps = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [view, setView] = useState<'compras' | 'deudas'>(() => (
    searchParams.get('view') === 'deudas' ? 'deudas' : 'compras'
  ))
  const [groupBy, setGroupBy] = useState<GroupBy>(() => parseGroupBy(searchParams.get('group_by')))
  const [granularity, setGranularity] = useState<Granularity>(() => parseGranularity(searchParams.get('granularity')))
  const [fromDate, setFromDate] = useState(() => searchParams.get('from') ?? '')
  const [toDate, setToDate] = useState(() => searchParams.get('to') ?? '')

  const [rows, setRows] = useState<ReportRow[]>([])
  const [totals, setTotals] = useState<ReportTotals>(EMPTY_TOTALS)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [agingSearch, setAgingSearch] = useState('')
  const [agingRows, setAgingRows] = useState<AgingRow[]>([])
  const [agingTotals, setAgingTotals] = useState<AgingTotals>(EMPTY_AGING_TOTALS)
  const [agingError, setAgingError] = useState<string | null>(null)
  const [agingLoading, setAgingLoading] = useState(true)

  // Persist filters in URL params (deep-linkable).
  useEffect(() => {
    const params = new URLSearchParams()
    if (view !== 'compras') params.set('view', view)
    if (groupBy !== 'period') params.set('group_by', groupBy)
    if (groupBy === 'period' && granularity !== 'month') params.set('granularity', granularity)
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [view, groupBy, granularity, fromDate, toDate, pathname, router])

  const loadReport = useCallback(async () => {
    const params = new URLSearchParams({ group_by: groupBy })
    if (groupBy === 'period') params.set('granularity', granularity)
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    setLoading(true)
    try {
      const d = await fetchJson<ReportResponse>(`/api/v1/purchases/reports?${params}`)
      setRows(d.rows ?? [])
      setTotals(d.totals ?? EMPTY_TOTALS)
      setError(null)
    } catch (e) {
      setError(getApiErrorMessage(e))
      setRows([])
      setTotals(EMPTY_TOTALS)
    } finally {
      setLoading(false)
    }
  }, [groupBy, granularity, fromDate, toDate])

  useEffect(() => {
    if (view !== 'compras') return
    const t = setTimeout(() => { void loadReport() }, 0)
    return () => clearTimeout(t)
  }, [view, loadReport])

  const loadAging = useCallback(async () => {
    const params = new URLSearchParams({ limit: '100' })
    if (agingSearch) params.set('search', agingSearch)
    setAgingLoading(true)
    try {
      const d = await fetchJson<AgingResponse>(`/api/v1/purchases/reports/payables-aging?${params}`)
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
    if (view !== 'deudas') return
    const t = setTimeout(() => { void loadAging() }, 0)
    return () => clearTimeout(t)
  }, [view, loadAging])

  const columns = useMemo<Column<ReportRow>[]>(() => [
    {
      key: 'label',
      header: GROUP_LABEL[groupBy],
      render: row => <span className="font-medium text-fg">{row.label}</span>,
    },
    {
      key: 'count',
      header: 'Comprobantes',
      align: 'right',
      render: row => <span className="tabular-nums text-fg-muted">{row.count}</span>,
    },
    {
      key: 'subtotal',
      header: 'Subtotal',
      align: 'right',
      render: row => <span className="tabular-nums text-fg-muted">{formatARS(row.subtotal)}</span>,
    },
    {
      key: 'tax_amount',
      header: 'IVA',
      align: 'right',
      render: row => <span className="tabular-nums text-fg-muted">{formatARS(row.tax_amount)}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: row => <span className="tabular-nums font-medium text-fg">{formatARS(row.total)}</span>,
    },
  ], [groupBy])

  const chartData = useMemo(
    () => rows.map(r => ({ label: r.label, value: Number(r.total) })),
    [rows],
  )

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

  if (view === 'deudas') {
    return (
      <div className="flex h-full flex-col">
        <TopBar
          breadcrumbs={breadcrumbs}
          actions={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => exportAgingCsv(agingRows, agingTotals)}
              disabled={agingRows.length === 0}
            >
              Exportar CSV
            </Button>
          }
        />
        {subnav}

        <PageBody>
          {agingError && <p className="mb-3 text-sm text-danger">{agingError}</p>}

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-sm border border-border-strong bg-surface p-0.5" role="group" aria-label="Vista">
              {REPORT_VIEW_OPTIONS.map(option => (
                <Button
                  key={option.value}
                  type="button"
                  size="xs"
                  variant="ghost"
                  aria-pressed={view === option.value}
                  className={view === option.value
                    ? 'bg-brand-600 text-white hover:bg-brand-600 hover:text-white'
                    : ''}
                  onClick={() => setView(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>

            <input
              type="text"
              className="h-[30px] rounded-sm border border-border-strong bg-surface px-2 text-[13px] text-fg-muted focus:border-ring focus:outline-none"
              placeholder="Buscar proveedor o CUIT..."
              value={agingSearch}
              onChange={e => setAgingSearch(e.target.value)}
            />

            <span className="flex-1" />
            <span className="text-[12px] text-fg-muted">
              {agingTotals.invoices_count} factura{agingTotals.invoices_count !== 1 ? 's' : ''} con saldo
            </span>
          </div>

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
        </PageBody>
      </div>
    )
  }

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

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-sm border border-border-strong bg-surface p-0.5" role="group" aria-label="Vista">
            {REPORT_VIEW_OPTIONS.map(option => (
              <Button
                key={option.value}
                type="button"
                size="xs"
                variant="ghost"
                aria-pressed={view === option.value}
                className={view === option.value
                  ? 'bg-brand-600 text-white hover:bg-brand-600 hover:text-white'
                  : ''}
                onClick={() => setView(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>

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
            {totals.count} comprobante{totals.count !== 1 ? 's' : ''}
          </span>
        </div>

        {groupBy === 'period' && rows.length > 0 && (
          <div className="mb-4 rounded border border-border bg-surface p-4">
            <p className="mb-2 text-[12px] uppercase tracking-wide text-fg-muted">Compras por período</p>
            <PanelBarChart data={chartData} />
          </div>
        )}

        <DataTable
          columns={columns}
          data={rows}
          keyExtractor={row => row.key}
          emptyMessage={loading ? 'Cargando…' : 'No hay compras para los filtros seleccionados.'}
          footer={
            rows.length > 0 ? (
              <div className="flex items-center justify-between px-3 py-2 text-[13px] font-medium text-fg">
                <span>Total</span>
                <div className="flex items-center gap-6">
                  <span className="tabular-nums">{totals.count} comp.</span>
                  <span className="tabular-nums">Subtotal {formatARS(totals.subtotal)}</span>
                  <span className="tabular-nums">IVA {formatARS(totals.tax_amount)}</span>
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
