'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { StatusBadge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { ProduccionSubNav } from '../ProduccionSubNav'
import type { ProductionOrder, ProductionOrderStatus } from '../types'
import { PRODUCTION_ORDER_STATUS_LABEL } from '../types'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { useDebouncedValue } from '@/lib/use-debounced-value'

const PAGE_SIZE = 20

const STATUS_OPTIONS: { value: ProductionOrderStatus | ''; label: string }[] = [
  { value: '',           label: 'Todos los estados' },
  { value: 'draft',      label: 'Borrador' },
  { value: 'released',   label: 'Liberada' },
  { value: 'in_process', label: 'En proceso' },
  { value: 'done',       label: 'Terminada' },
  { value: 'cancelled',  label: 'Cancelada' },
]

const COLUMNS: Column<ProductionOrder>[] = [
  {
    key: 'order_number',
    header: 'N°',
    render: row => <span className="font-mono text-[12px] text-fg-muted">{row.order_number}</span>,
  },
  {
    key: 'variant',
    header: 'Producto terminado',
    render: row => row.variant
      ? <span className="font-medium text-fg">{row.variant.product?.name ?? row.variant.name ?? row.variant.sku}</span>
      : <span className="text-fg-subtle">—</span>,
  },
  {
    key: 'status',
    header: 'Estado',
    render: row => <StatusBadge value={PRODUCTION_ORDER_STATUS_LABEL[row.status]} />,
  },
  {
    key: 'planned_quantity',
    header: 'Planificada',
    render: row => <span className="tabular-nums">{parseFloat(row.planned_quantity).toLocaleString('es-AR')}</span>,
  },
  {
    key: 'produced_quantity',
    header: 'Producida',
    render: row => <span className="tabular-nums text-fg-muted">{parseFloat(row.produced_quantity).toLocaleString('es-AR')}</span>,
  },
  {
    key: 'branch',
    header: 'Sucursal',
    render: row => row.branch?.name ?? <span className="text-fg-subtle">—</span>,
  },
]

export function OrdenesClient() {
  const router = useRouter()
  const [orders, setOrders]   = useState<ProductionOrder[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [search, setSearch]   = useState('')
  const [status, setStatus]   = useState<ProductionOrderStatus | ''>('')
  const [error, setError]     = useState<string | null>(null)

  const debouncedSearch = useDebouncedValue(search, 300)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (status) params.set('status', status)
    ;(async () => {
      try {
        const d = await fetchJson<{ data: ProductionOrder[]; total: number }>(
          `/api/v1/production/orders?${params}`,
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

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Producción', href: '/produccion' }, { label: 'Órdenes de producción' }]}
        actions={
          <Button size="sm" onClick={() => router.push('/produccion/ordenes/nueva')}>
            Nueva orden
          </Button>
        }
      />
      <ProduccionSubNav />

      <PageBody>
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <DataTable
          columns={COLUMNS}
          data={orders}
          keyExtractor={row => row.id}
          onRowClick={row => router.push(`/produccion/ordenes/${row.id}`)}
          emptyMessage="No hay órdenes de producción"
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
              <select
                value={status}
                onChange={e => { setStatus(e.target.value as ProductionOrderStatus | ''); setPage(1) }}
                className="h-[30px] text-[13px] border border-border-strong rounded-sm px-2 bg-surface focus:outline-none focus:border-ring text-fg-muted"
              >
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
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
