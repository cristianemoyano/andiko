'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { Badge, StatusBadge } from '@/components/primitives/Badge'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { ComprasSubNav } from '../ComprasSubNav'
import { PURCHASE_ORDER_STATUS_LABEL } from '../types'
import type { PurchaseOrderStatus } from '../types'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

const PAGE_SIZE = 20

export type ReconciliationListRow = {
  id: string
  order_number: string
  status: PurchaseOrderStatus
  created_at: string
  expected_date: string | null
  contact: { id: string; legal_name: string; trade_name: string | null } | null
  ordered_qty: string
  received_qty: string
  invoiced_qty: string
  ordered_total: string
  invoiced_total: string
  receipt_count: number
  invoice_count: number
  qty_mismatch: boolean
  price_mismatch: boolean
  has_differences: boolean
}

export function ReconciliationChip({ hasDifferences }: { hasDifferences: boolean }) {
  return hasDifferences
    ? <Badge status="error" dot>Diferencias</Badge>
    : <Badge status="success" dot>OK</Badge>
}

const COLUMNS: Column<ReconciliationListRow>[] = [
  {
    key: 'order_number',
    header: 'N°',
    render: row => <span className="font-mono text-[12px] text-zinc-600">{row.order_number}</span>,
  },
  {
    key: 'contact',
    header: 'Proveedor',
    render: row =>
      row.contact ? (
        <span className="font-medium text-zinc-900">{row.contact.trade_name ?? row.contact.legal_name}</span>
      ) : (
        <span className="text-zinc-400">—</span>
      ),
  },
  {
    key: 'status',
    header: 'Estado OC',
    render: row => <StatusBadge value={PURCHASE_ORDER_STATUS_LABEL[row.status] ?? row.status} />,
  },
  {
    key: 'ordered_qty',
    header: 'Cant. pedida',
    align: 'right',
    render: row => <span className="tabular-nums text-zinc-700">{row.ordered_qty}</span>,
  },
  {
    key: 'received_qty',
    header: 'Cant. recibida',
    align: 'right',
    render: row => (
      <span className={`tabular-nums ${row.qty_mismatch ? 'font-medium text-red-600' : 'text-zinc-700'}`}>
        {row.received_qty}
      </span>
    ),
  },
  {
    key: 'invoiced_qty',
    header: 'Cant. facturada',
    align: 'right',
    render: row => (
      <span className={`tabular-nums ${row.qty_mismatch ? 'font-medium text-red-600' : 'text-zinc-700'}`}>
        {row.invoiced_qty}
      </span>
    ),
  },
  {
    key: 'ordered_total',
    header: 'Total OC',
    align: 'right',
    render: row => <span className="tabular-nums text-zinc-700">{formatARS(row.ordered_total)}</span>,
  },
  {
    key: 'invoiced_total',
    header: 'Total facturado',
    align: 'right',
    render: row => (
      <span className={`tabular-nums ${row.price_mismatch ? 'font-medium text-red-600' : 'text-zinc-700'}`}>
        {formatARS(row.invoiced_total)}
      </span>
    ),
  },
  {
    key: 'reconciliation',
    header: 'Conciliación',
    render: row => <ReconciliationChip hasDifferences={row.has_differences} />,
  },
]

export function ConciliacionClient() {
  const router = useRouter()
  const [rows, setRows] = useState<ReconciliationListRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [onlyDifferences, setOnlyDifferences] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadRows = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (search) params.set('search', search)
    if (onlyDifferences) params.set('only_differences', 'true')
    setLoading(true)
    try {
      const d = await fetchJson<{ data: ReconciliationListRow[]; total: number }>(
        `/api/v1/purchases/reconciliation?${params}`,
      )
      setRows(d.data ?? [])
      setTotal(d.total ?? 0)
      setError(null)
    } catch (e) {
      setError(getApiErrorMessage(e))
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, search, onlyDifferences])

  useEffect(() => {
    const t = setTimeout(() => { void loadRows() }, 0)
    return () => clearTimeout(t)
  }, [loadRows])

  return (
    <div className="flex h-full flex-col">
      <TopBar breadcrumbs={[{ label: 'Compras', href: '/compras' }, { label: 'Conciliación' }]} />
      <ComprasSubNav />

      <div className="flex-1 overflow-auto p-5">
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <DataTable
          columns={COLUMNS}
          data={rows}
          keyExtractor={row => row.id}
          onRowClick={row => router.push(`/compras/conciliacion/${row.id}`)}
          emptyMessage={
            loading
              ? 'Cargando…'
              : onlyDifferences
                ? 'No hay órdenes con diferencias.'
                : 'No hay órdenes de compra para conciliar.'
          }
          toolbar={
            <>
              <div className="relative flex items-center">
                <svg className="pointer-events-none absolute left-2 text-zinc-400" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5l3 3" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar por proveedor o número…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  className="h-[30px] w-60 rounded-sm border border-zinc-300 bg-white pl-7 pr-3 text-[13px] focus:border-blue-500 focus:outline-none"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-1.5 text-[13px] text-zinc-700">
                <input
                  type="checkbox"
                  checked={onlyDifferences}
                  onChange={e => { setOnlyDifferences(e.target.checked); setPage(1) }}
                  className="h-3.5 w-3.5 accent-brand-600"
                />
                Solo con diferencias
              </label>
              <span className="flex-1" />
              <span className="text-[12px] text-zinc-500">{total} orden{total !== 1 ? 'es' : ''}</span>
            </>
          }
          footer={
            total > 0 ? (
              <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            ) : undefined
          }
        />
      </div>
    </div>
  )
}
