'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { StatusBadge } from '@/components/primitives/Badge'
import { formatARS } from '@/components/primitives/CurrencyInput'
import type { Invoice, InvoiceStatus } from '../types'
import { INVOICE_STATUS_LABEL } from '../types'
import { VentasSubNav } from '../VentasSubNav'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

const PAGE_SIZE = 20

const STATUS_OPTIONS: { value: InvoiceStatus | ''; label: string }[] = [
  { value: '',               label: 'Todos los estados' },
  { value: 'draft',          label: 'Borrador' },
  { value: 'issued',         label: 'Emitida' },
  { value: 'partially_paid', label: 'Pago parcial' },
  { value: 'paid',           label: 'Pagada' },
  { value: 'cancelled',      label: 'Anulada' },
]

const COLUMNS: Column<Invoice>[] = [
  {
    key: 'invoice_number',
    header: 'N°',
    render: row => (
      <span className="font-mono text-[12px] text-zinc-600">{row.invoice_number}</span>
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
    render: row => <StatusBadge value={INVOICE_STATUS_LABEL[row.status]} />,
  },
  {
    key: 'issue_date',
    header: 'Fecha emisión',
    sortable: true,
    render: row =>
      row.issue_date
        ? new Date(row.issue_date).toLocaleDateString('es-AR')
        : <span className="text-zinc-400">—</span>,
  },
  {
    key: 'due_date',
    header: 'Vencimiento',
    render: row =>
      row.due_date
        ? new Date(row.due_date).toLocaleDateString('es-AR')
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
    key: 'balance',
    header: 'Saldo',
    render: row => {
      const balance = parseFloat(row.balance)
      return (
        <span className={`tabular-nums font-medium ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
          {formatARS(row.balance)}
        </span>
      )
    },
  },
]

export function FacturasClient() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | ''>('')
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
        const data = await fetchJson<{ data: Invoice[]; total: number }>(`/api/v1/sales/invoices?${params}`)
        if (!mounted) return
        const rows = Array.isArray(data?.data) ? data.data : []
        const nextTotal = typeof data?.total === 'number' ? data.total : 0
        setInvoices(rows)
        setTotal(nextTotal)
        const pages = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE))
        setPage(p => (p > pages ? pages : p))
      } catch (e) {
        if (!mounted) return
        setListError(getApiErrorMessage(e))
        setInvoices([])
        setTotal(0)
      }
    })()
    return () => { mounted = false }
  }, [page, search, statusFilter])

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Ventas', href: '/ventas/presupuestos' }, { label: 'Facturas' }]}
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
          data={invoices}
          keyExtractor={r => r.id}
          onRowClick={row => router.push(`/ventas/facturas/${row.id}`)}
          emptyMessage="Las facturas se generan desde pedidos entregados."
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
                onChange={e => { setStatusFilter(e.target.value as InvoiceStatus | ''); setPage(1) }}
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
