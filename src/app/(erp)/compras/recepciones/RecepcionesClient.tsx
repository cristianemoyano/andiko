'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { StatusBadge } from '@/components/primitives/Badge'
import { ComprasSubNav } from '../ComprasSubNav'
import type { PurchaseReceipt, PurchaseReceiptStatus } from '../types'
import { PURCHASE_RECEIPT_STATUS_LABEL } from '../types'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

const PAGE_SIZE = 20

const STATUS_OPTIONS: { value: PurchaseReceiptStatus | ''; label: string }[] = [
  { value: '',          label: 'Todos los estados' },
  { value: 'draft',     label: 'Borrador' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'cancelled', label: 'Cancelado' },
]

const COLUMNS: Column<PurchaseReceipt>[] = [
  {
    key: 'receipt_number',
    header: 'N°',
    render: row => <span className="font-mono text-[12px] text-zinc-600">{row.receipt_number}</span>,
  },
  {
    key: 'contact',
    header: 'Proveedor',
    render: row =>
      row.contact ? (
        <span className="font-medium text-zinc-900">{row.contact.legal_name}</span>
      ) : (
        <span className="text-zinc-400">—</span>
      ),
  },
  {
    key: 'warehouse',
    header: 'Depósito',
    render: row =>
      row.warehouse ? (
        <span className="text-zinc-700">{row.warehouse.name}</span>
      ) : (
        <span className="text-zinc-400">—</span>
      ),
  },
  {
    key: 'status',
    header: 'Estado',
    render: row => <StatusBadge value={PURCHASE_RECEIPT_STATUS_LABEL[row.status]} />,
  },
  {
    key: 'receipt_date',
    header: 'Fecha',
    render: row =>
      row.receipt_date
        ? new Date(row.receipt_date).toLocaleDateString('es-AR')
        : <span className="text-zinc-400">—</span>,
  },
]

export function RecepcionesClient() {
  const router = useRouter()
  const [receipts, setReceipts] = useState<PurchaseReceipt[] | null>(null)
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [status, setStatus]     = useState<PurchaseReceiptStatus | ''>('')
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (search) params.set('search', search)
    if (status) params.set('status', status)
    ;(async () => {
      try {
        const d = await fetchJson<{ data: PurchaseReceipt[]; total: number }>(`/api/v1/purchases/receipts?${params}`)
        if (!mounted) return
        setReceipts(d.data ?? [])
        setTotal(d.total ?? 0)
        setError(null)
      } catch (e) {
        if (!mounted) return
        setError(getApiErrorMessage(e))
        setReceipts([])
        setTotal(0)
      }
    })()
    return () => { mounted = false }
  }, [page, search, status])

  return (
    <div className="flex flex-col h-full">
      <TopBar breadcrumbs={[{ label: 'Compras', href: '/compras' }, { label: 'Recepciones' }]} />
      <ComprasSubNav />

      <div className="flex-1 p-5 overflow-auto">
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <DataTable
          columns={COLUMNS}
          data={receipts}
          keyExtractor={row => row.id}
          onRowClick={row => router.push(`/compras/recepciones/${row.id}`)}
          emptyMessage="No hay recepciones registradas"
          toolbar={
            <>
              <div className="relative flex items-center w-full sm:w-auto">
                <svg className="absolute left-2 text-zinc-400 pointer-events-none" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/>
                </svg>
                <input
                  type="text"
                  placeholder="Buscar por número…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  className="pl-7 pr-3 h-[30px] text-[13px] border border-zinc-300 rounded-sm w-full sm:w-52 bg-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <select
                value={status}
                onChange={e => { setStatus(e.target.value as PurchaseReceiptStatus | ''); setPage(1) }}
                className="h-[30px] text-[13px] border border-zinc-300 rounded-sm px-2 bg-white focus:outline-none focus:border-blue-500 text-zinc-700"
              >
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <span className="flex-1" />
              <span className="text-[12px] text-zinc-500">{total} registro{total !== 1 ? 's' : ''}</span>
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
