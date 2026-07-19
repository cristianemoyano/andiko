'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, DocumentStatusNav, TablePagination, type Column } from '@/components/erp'
import { StatusBadge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { ComprasSubNav } from '../ComprasSubNav'
import type { PurchaseOrder, PurchaseOrderStatus } from '../types'
import { PURCHASE_ORDER_STATUS_LABEL, PAYMENT_CONDITION_LABEL } from '../types'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { useDebouncedValue } from '@/lib/use-debounced-value'

const PAGE_SIZE = 20

type OrderStatusTab = PurchaseOrderStatus | ''

const STATUS_TABS: readonly { key: OrderStatusTab; label: string }[] = [
  { key: '',                   label: 'Todos' },
  { key: 'draft',              label: 'Borrador' },
  { key: 'sent',               label: 'Enviado' },
  { key: 'partially_received', label: 'Recibido parcial' },
  { key: 'received',           label: 'Recibido' },
  { key: 'partial_returned',   label: 'Devuelto parcial' },
  { key: 'returned',           label: 'Devuelto' },
  { key: 'cancelled',          label: 'Cancelado' },
]

const EMPTY_STATUS_COUNTS: Record<OrderStatusTab, number> = {
  '': 0,
  draft: 0,
  sent: 0,
  partially_received: 0,
  received: 0,
  partial_returned: 0,
  returned: 0,
  cancelled: 0,
}

const COLUMNS: Column<PurchaseOrder>[] = [
  {
    key: 'order_number',
    header: 'N°',
    render: row => <span className="font-mono text-[12px] text-fg-muted">{row.order_number}</span>,
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
    key: 'status',
    header: 'Estado',
    render: row => <StatusBadge value={PURCHASE_ORDER_STATUS_LABEL[row.status]} />,
  },
  {
    key: 'expected_date',
    header: 'Fecha esperada',
    render: row =>
      row.expected_date
        ? new Date(row.expected_date).toLocaleDateString('es-AR')
        : <span className="text-fg-subtle">—</span>,
  },
  {
    key: 'payment_condition',
    header: 'Condición',
    render: row => PAYMENT_CONDITION_LABEL[row.payment_condition] ?? row.payment_condition,
  },
  {
    key: 'buyer',
    header: 'Comprador',
    render: row => row.buyer
      ? <span className="text-[12px] text-fg-muted">{row.buyer.name}</span>
      : <span className="text-fg-subtle">—</span>,
  },
  {
    key: 'total',
    header: 'Total',
    render: row => <span className="tabular-nums font-medium">{formatARS(row.total)}</span>,
  },
]

export function OrdenesClient() {
  const router = useRouter()
  const [orders, setOrders]   = useState<PurchaseOrder[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [search, setSearch]   = useState('')
  const [status, setStatus]   = useState<OrderStatusTab>('')
  const [statusCounts, setStatusCounts] = useState(EMPTY_STATUS_COUNTS)
  const [error, setError]     = useState<string | null>(null)

  const debouncedSearch = useDebouncedValue(search, 300)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (status) params.set('status', status)
    ;(async () => {
      try {
        const d = await fetchJson<{ data: PurchaseOrder[]; total: number }>(
          `/api/v1/purchases/orders?${params}`,
          { signal: controller.signal },
        )
        setOrders(d.data ?? [])
        setTotal(d.total ?? 0)
        setError(null)
      } catch (e) {
        if (controller.signal.aborted) return
        setError(getApiErrorMessage(e))
        setOrders([])
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
        const res = await fetchJson<{ data: Record<OrderStatusTab, number> }>(
          `/api/v1/purchases/orders/status-counts?${params}`,
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
      <TopBar
        breadcrumbs={[{ label: 'Compras', href: '/compras' }, { label: 'Órdenes de compra' }]}
        actions={
          <Button size="sm" onClick={() => router.push('/compras/ordenes/nueva')}>
            + Nueva orden
          </Button>
        }
      />
      <ComprasSubNav />
      <DocumentStatusNav
        tabs={STATUS_TABS}
        active={status}
        counts={statusCounts}
        onChange={next => { setStatus(next); setPage(1) }}
        ariaLabel="Filtrar órdenes de compra por estado"
      />

      <PageBody>
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <DataTable
          columns={COLUMNS}
          data={orders}
          keyExtractor={row => row.id}
          onRowClick={row => router.push(`/compras/ordenes/${row.id}`)}
          emptyMessage="No hay órdenes de compra"
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
