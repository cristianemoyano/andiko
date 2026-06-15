'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
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

const EMPTY_TOTALS: ReportTotals = { count: 0, subtotal: '0.00', tax_amount: '0.00', total: '0.00' }

const GROUP_BY_OPTIONS: Array<{ value: GroupBy; label: string }> = [
  { value: 'period',   label: 'Por período' },
  { value: 'supplier', label: 'Por proveedor' },
  { value: 'category', label: 'Por categoría' },
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

export function ReportesClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [groupBy, setGroupBy] = useState<GroupBy>(() => parseGroupBy(searchParams.get('group_by')))
  const [granularity, setGranularity] = useState<Granularity>(() => parseGranularity(searchParams.get('granularity')))
  const [fromDate, setFromDate] = useState(() => searchParams.get('from') ?? '')
  const [toDate, setToDate] = useState(() => searchParams.get('to') ?? '')

  const [rows, setRows] = useState<ReportRow[]>([])
  const [totals, setTotals] = useState<ReportTotals>(EMPTY_TOTALS)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Persist filters in URL params (deep-linkable).
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
    const t = setTimeout(() => { void loadReport() }, 0)
    return () => clearTimeout(t)
  }, [loadReport])

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

  return (
    <div className="flex h-full flex-col">
      <TopBar
        breadcrumbs={[{ label: 'Compras', href: '/compras' }, { label: 'Reportes' }]}
        actions={
          <Button size="sm" variant="secondary" onClick={() => exportCsv(rows, totals, groupBy)} disabled={rows.length === 0}>
            Exportar CSV
          </Button>
        }
      />
      <ComprasSubNav />

      <div className="flex-1 overflow-auto p-5">
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}

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
      </div>
    </div>
  )
}
