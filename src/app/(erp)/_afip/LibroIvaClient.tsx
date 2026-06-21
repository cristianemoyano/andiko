'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { DataTable, type Column, COMPROBANTE_TIPO_LABEL } from '@/components/erp'
import { DatePicker } from '@/components/primitives/DatePicker'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { fetchJson } from '@/lib/fetch-json'
import { notifyApiError } from '@/lib/notify'

type LibroRow = {
  date: string | null
  kind: 'invoice' | 'credit_note' | 'debit_note'
  comprobante_tipo: number | null
  number: string
  contact_name: string | null
  cuit: string | null
  cae: string | null
  neto: string
  iva: string
  total: string
  sign: 1 | -1
}

type LibroResult = {
  from: string
  to: string
  rows: LibroRow[]
  totals: { neto: string; iva: string; total: string; count: number }
}

const KIND_LABEL: Record<LibroRow['kind'], string> = {
  invoice: 'Factura',
  credit_note: 'Nota de crédito',
  debit_note: 'Nota de débito',
}

function comprobanteLabel(row: LibroRow): string {
  if (row.comprobante_tipo != null) return COMPROBANTE_TIPO_LABEL[row.comprobante_tipo] ?? KIND_LABEL[row.kind]
  return KIND_LABEL[row.kind]
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function startOfMonth(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

export interface LibroIvaClientProps {
  endpoint: string
  breadcrumbs: { label: string; href?: string }[]
  subnav: ReactNode
  counterpartyHeader: string
  showCae: boolean
}

function parseISODate(raw: string | null): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const d = new Date(`${raw}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function LibroIvaClient({ endpoint, breadcrumbs, subnav, counterpartyHeader, showCae }: LibroIvaClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialFrom = searchParams.get('from')
  const initialTo = searchParams.get('to')
  const [from, setFrom] = useState<Date | null>(() => parseISODate(initialFrom) ?? startOfMonth())
  const [to, setTo] = useState<Date | null>(() => parseISODate(initialTo) ?? new Date())

  const [result, setResult] = useState<LibroResult | null>(null)
  const [loading, setLoading] = useState(false)

  const fromISO = from ? toISO(from) : ''
  const toISOStr = to ? toISO(to) : ''

  useEffect(() => {
    if (!fromISO || !toISOStr) return
    let cancelled = false
    queueMicrotask(() => setLoading(true))
    fetchJson<LibroResult>(`${endpoint}?from=${fromISO}&to=${toISOStr}`)
      .then(data => { if (!cancelled) setResult(data) })
      .catch(e => { if (!cancelled) { setResult(null); notifyApiError(e) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [endpoint, fromISO, toISOStr])

  // Keep the date range in the URL for shareable/persistent filters.
  useEffect(() => {
    if (!fromISO || !toISOStr) return
    router.replace(`?from=${fromISO}&to=${toISOStr}`, { scroll: false })
  }, [router, fromISO, toISOStr])

  const columns = useMemo<Column<LibroRow>[]>(() => {
    const cols: Column<LibroRow>[] = [
      { key: 'date', header: 'Fecha', render: r => r.date ? new Date(r.date).toLocaleDateString('es-AR') : '—' },
      { key: 'comprobante', header: 'Comprobante', render: r => comprobanteLabel(r) },
      { key: 'number', header: 'Número', render: r => <span className="font-mono text-[12px] text-fg-muted">{r.number}</span> },
      { key: 'contact_name', header: counterpartyHeader, render: r => r.contact_name ?? <span className="text-fg-subtle">—</span> },
      { key: 'cuit', header: 'CUIT', render: r => r.cuit ? <span className="font-mono text-[12px]">{r.cuit}</span> : <span className="text-fg-subtle">—</span> },
      { key: 'neto', header: 'Neto', align: 'right', render: r => <span className="tabular-nums">{formatARS(r.neto)}</span> },
      { key: 'iva', header: 'IVA', align: 'right', render: r => <span className="tabular-nums">{formatARS(r.iva)}</span> },
      { key: 'total', header: 'Total', align: 'right', render: r => <span className="tabular-nums font-medium">{formatARS(r.total)}</span> },
    ]
    if (showCae) {
      cols.push({ key: 'cae', header: 'CAE', render: r => r.cae ? <span className="font-mono text-[12px] text-fg-muted">{r.cae}</span> : <span className="text-fg-subtle">—</span> })
    }
    return cols
  }, [counterpartyHeader, showCae])

  const totals = result?.totals

  return (
    <div className="flex h-full flex-col">
      <TopBar breadcrumbs={breadcrumbs} />
      {subnav}

      <div className="flex-1 overflow-auto p-5">
        <DataTable
          columns={columns}
          data={loading ? null : (result?.rows ?? [])}
          keyExtractor={(r) => `${r.kind}-${r.number}`}
          emptyMessage={loading ? 'Cargando comprobantes…' : 'No hay comprobantes en el período.'}
          stickyFirstColumn
          toolbar={
            <>
              <label className="flex items-center gap-1.5 text-[12px] text-fg-muted">
                Desde
                <DatePicker value={from} onChange={setFrom} className="w-[7.5rem]" />
              </label>
              <label className="flex items-center gap-1.5 text-[12px] text-fg-muted">
                Hasta
                <DatePicker value={to} onChange={setTo} className="w-[7.5rem]" />
              </label>
              <span className="flex-1" />
              <span className="text-[12px] text-fg-muted">
                {loading
                  ? 'Cargando…'
                  : `${totals?.count ?? 0} comprobante${(totals?.count ?? 0) !== 1 ? 's' : ''}`}
              </span>
            </>
          }
          footer={
            totals ? (
              <>
                <span>Neto: <span className="tabular-nums font-medium text-fg">{formatARS(totals.neto)}</span></span>
                <span>IVA: <span className="tabular-nums font-medium text-fg">{formatARS(totals.iva)}</span></span>
                <span>Total: <span className="tabular-nums font-semibold text-fg">{formatARS(totals.total)}</span></span>
              </>
            ) : undefined
          }
        />
      </div>
    </div>
  )
}
