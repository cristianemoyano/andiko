'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, DocumentStatusNav, TablePagination, type Column } from '@/components/erp'
import { StatusBadge } from '@/components/primitives/Badge'
import { ComprasSubNav } from '../ComprasSubNav'
import type { PurchaseReceipt, PurchaseReceiptStatus } from '../types'
import { PURCHASE_RECEIPT_STATUS_LABEL } from '../types'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { useDebouncedValue } from '@/lib/use-debounced-value'

const PAGE_SIZE = 20

type ReceiptStatusTab = PurchaseReceiptStatus | ''

const STATUS_TABS: readonly { key: ReceiptStatusTab; label: string }[] = [
  { key: '',          label: 'Todas' },
  { key: 'draft',     label: 'Borrador' },
  { key: 'confirmed', label: 'Confirmada' },
  { key: 'cancelled', label: 'Cancelada' },
]

const EMPTY_STATUS_COUNTS: Record<ReceiptStatusTab, number> = {
  '': 0,
  draft: 0,
  confirmed: 0,
  cancelled: 0,
}

const COLUMNS: Column<PurchaseReceipt>[] = [
  {
    key: 'receipt_number',
    header: 'N°',
    render: row => <span className="font-mono text-[12px] text-fg-muted">{row.receipt_number}</span>,
  },
  {
    key: 'contact',
    header: 'Proveedor',
    render: row =>
      row.contact ? (
        <span className="font-medium text-fg">{row.contact.legal_name}</span>
      ) : (
        <span className="text-fg-subtle">—</span>
      ),
  },
  {
    key: 'warehouse',
    header: 'Depósito',
    render: row =>
      row.warehouse ? (
        <span className="text-fg-muted">{row.warehouse.name}</span>
      ) : (
        <span className="text-fg-subtle">—</span>
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
        : <span className="text-fg-subtle">—</span>,
  },
]

export function RecepcionesClient() {
  const router = useRouter()
  const [receipts, setReceipts] = useState<PurchaseReceipt[] | null>(null)
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [status, setStatus]     = useState<ReceiptStatusTab>('')
  const [statusCounts, setStatusCounts] = useState(EMPTY_STATUS_COUNTS)
  const [error, setError]       = useState<string | null>(null)

  const debouncedSearch = useDebouncedValue(search, 300)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (status) params.set('status', status)
    ;(async () => {
      try {
        const d = await fetchJson<{ data: PurchaseReceipt[]; total: number }>(
          `/api/v1/purchases/receipts?${params}`,
          { signal: controller.signal },
        )
        setReceipts(d.data ?? [])
        setTotal(d.total ?? 0)
        setError(null)
      } catch (e) {
        if (controller.signal.aborted) return
        setError(getApiErrorMessage(e))
        setReceipts([])
        setTotal(0)
      }
    })()
    return () => { controller.abort() }
  }, [page, debouncedSearch, status])

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    })
    void (async () => {
      try {
        const res = await fetchJson<{ data: Record<ReceiptStatusTab, number> }>(
          `/api/v1/purchases/receipts/status-counts?${params}`,
          { signal: controller.signal },
        )
        setStatusCounts({ ...EMPTY_STATUS_COUNTS, ...(res.data ?? {}) })
      } catch {
        if (!controller.signal.aborted) setStatusCounts(EMPTY_STATUS_COUNTS)
      }
    })()
    return () => { controller.abort() }
  }, [debouncedSearch])

  return (
    <div className="flex flex-col h-full">
      <TopBar breadcrumbs={[{ label: 'Compras', href: '/compras' }, { label: 'Recepciones' }]} />
      <ComprasSubNav />
      <DocumentStatusNav
        tabs={STATUS_TABS}
        active={status}
        counts={statusCounts}
        onChange={next => { setStatus(next); setPage(1) }}
        ariaLabel="Filtrar recepciones por estado"
      />

      <PageBody>
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <DataTable
          columns={COLUMNS}
          data={receipts}
          keyExtractor={row => row.id}
          onRowClick={row => router.push(`/compras/recepciones/${row.id}`)}
          emptyMessage="No hay recepciones registradas"
          toolbar={
            <>
              <div className="relative flex items-center w-full sm:w-auto">
                <svg className="absolute left-2 text-fg-subtle pointer-events-none" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/>
                </svg>
                <input
                  type="text"
                  placeholder="Buscar por número…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  className="pl-7 pr-3 h-[30px] text-[13px] border border-border-strong rounded-sm w-full sm:w-52 bg-surface focus:outline-none focus:border-ring"
                />
              </div>
              <span className="flex-1" />
              <span className="text-[12px] text-fg-muted">{total} registro{total !== 1 ? 's' : ''}</span>
            </>
          }
          footer={
            total > 0 ? (
              <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            ) : undefined
          }
        />
      </PageBody>
    </div>
  )
}
