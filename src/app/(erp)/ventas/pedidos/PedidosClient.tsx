'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { StatusBadge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { formatARS } from '@/components/primitives/CurrencyInput'
import type { Order, OrderStatus } from '../types'
import { ORDER_STATUS_LABEL, PAYMENT_CONDITION_LABEL } from '../types'
import { VentasSubNav } from '../VentasSubNav'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

const PAGE_SIZE = 20

const STATUS_OPTIONS: { value: OrderStatus | ''; label: string }[] = [
  { value: '',            label: 'Todos los estados' },
  { value: 'draft',       label: 'Borrador' },
  { value: 'confirmed',   label: 'Confirmado' },
  { value: 'in_progress', label: 'En proceso' },
  { value: 'delivered',   label: 'Entregado' },
  { value: 'cancelled',   label: 'Cancelado' },
]

const COLUMNS: Column<Order>[] = [
  {
    key: 'order_number',
    header: 'N°',
    render: row => (
      <span className="font-mono text-[12px] text-zinc-600">{row.order_number}</span>
    ),
  },
  {
    key: 'branch',
    header: 'Sucursal',
    render: row =>
      row.branch ? (
        <span className="text-[12px] text-zinc-700">
          {String(row.branch.branch_code).padStart(2, '0')} — {row.branch.name}
        </span>
      ) : (
        <span className="text-zinc-400">—</span>
      ),
  },
  {
    key: 'contact',
    header: 'Cliente',
    sortable: true,
    render: row =>
      row.contact ? (
        <span className="font-medium text-zinc-900">{row.contact.legal_name}</span>
      ) : (
        <span className="text-zinc-400">—</span>
      ),
  },
  {
    key: 'status',
    header: 'Estado',
    render: row => <StatusBadge value={ORDER_STATUS_LABEL[row.status]} />,
  },
  {
    key: 'payment_condition',
    header: 'Condición',
    render: row => PAYMENT_CONDITION_LABEL[row.payment_condition],
  },
  {
    key: 'promised_date',
    header: 'Fecha prometida',
    render: row =>
      row.promised_date
        ? new Date(row.promised_date).toLocaleDateString('es-AR')
        : <span className="text-zinc-400">—</span>,
  },
  {
    key: 'salesperson',
    header: 'Vendedor',
    render: row => row.salesperson
      ? <span className="text-[12px] text-zinc-700">{row.salesperson.name}</span>
      : <span className="text-zinc-400">—</span>,
  },
  {
    key: 'total',
    header: 'Total',
    render: row => (
      <span className="tabular-nums font-medium">{formatARS(row.total)}</span>
    ),
  },
  {
    key: 'created_at',
    header: 'Fecha',
    sortable: true,
    render: row => new Date(row.created_at).toLocaleDateString('es-AR'),
  },
]

export function PedidosClient() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal]   = useState(0)
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('')
  const [listError, setListError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const params = new URLSearchParams({
      page:  String(page),
      limit: String(PAGE_SIZE),
      ...(search       ? { search }             : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    })
    ;(async () => {
      setListError(null)
      try {
        const data = await fetchJson<{ data: Order[]; total: number }>(`/api/v1/sales/orders?${params}`)
        if (!mounted) return
        const rows = Array.isArray(data?.data) ? data.data : []
        const nextTotal = typeof data?.total === 'number' ? data.total : 0
        setOrders(rows)
        setTotal(nextTotal)
        const pages = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE))
        setPage(p => (p > pages ? pages : p))
      } catch (e) {
        if (!mounted) return
        setListError(getApiErrorMessage(e))
        setOrders([])
        setTotal(0)
      }
    })()
    return () => { mounted = false }
  }, [page, search, statusFilter])

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Ventas', href: '/ventas/presupuestos' }, { label: 'Pedidos' }]}
        actions={
          <Button size="sm" onClick={() => router.push('/ventas/pedidos/nuevo')}>
            + Nuevo pedido
          </Button>
        }
      />
      <VentasSubNav />

      <div className="flex-1 p-5 overflow-auto">
        {listError && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {listError}
          </div>
        )}
        <DataTable
          columns={COLUMNS}
          data={orders}
          keyExtractor={r => r.id}
          onRowClick={row => router.push(`/ventas/pedidos/${row.id}`)}
          emptyMessage="No hay pedidos. Creá el primero."
          toolbar={
            <>
              <div className="relative flex items-center w-full sm:w-auto">
                <svg className="absolute left-2 text-zinc-400 pointer-events-none" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/>
                </svg>
                <input
                  className="pl-7 pr-3 h-[30px] text-[13px] border border-zinc-300 rounded-sm w-full sm:w-52 bg-white focus:outline-none focus:border-blue-500"
                  placeholder="Buscar por cliente o número…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                />
              </div>
              <select
                className="h-[30px] text-[13px] border border-zinc-300 rounded-sm px-2 bg-white focus:outline-none focus:border-blue-500 text-zinc-700"
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value as OrderStatus | ''); setPage(1) }}
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
