'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { StatusBadge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { ComprasSubNav } from '../ComprasSubNav'
import type { SupplierInvoice, SupplierInvoiceStatus } from '../types'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { SUPPLIER_INVOICE_STATUS_LABEL } from '../types'

const PAGE_SIZE = 20

const STATUS_OPTIONS: { value: SupplierInvoiceStatus | ''; label: string }[] = [
  { value: '',               label: 'Todos los estados' },
  { value: 'draft',          label: 'Borrador' },
  { value: 'received',       label: 'Recibida' },
  { value: 'partially_paid', label: 'Pago parcial' },
  { value: 'paid',           label: 'Pagada' },
  { value: 'cancelled',      label: 'Cancelada' },
]

const COLUMNS: Column<SupplierInvoice>[] = [
  {
    key: 'invoice_number',
    header: 'N° interno',
    render: row => <span className="font-mono text-[12px] text-fg-muted">{row.invoice_number}</span>,
  },
  {
    key: 'supplier_invoice_number',
    header: 'N° proveedor',
    render: row =>
      row.supplier_invoice_number ? (
        <span className="text-fg-muted">{row.supplier_invoice_number}</span>
      ) : (
        <span className="text-fg-subtle">—</span>
      ),
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
    render: row => <StatusBadge value={SUPPLIER_INVOICE_STATUS_LABEL[row.status]} />,
  },
  {
    key: 'due_date',
    header: 'Vencimiento',
    render: row =>
      row.due_date
        ? new Date(row.due_date).toLocaleDateString('es-AR')
        : <span className="text-fg-subtle">—</span>,
  },
  {
    key: 'total',
    header: 'Total',
    render: row => <span className="tabular-nums font-medium">{formatARS(row.total)}</span>,
  },
  {
    key: 'balance',
    header: 'Saldo',
    render: row => (
      <span className={`tabular-nums ${parseFloat(row.balance) > 0 ? 'text-danger font-medium' : 'text-fg-subtle'}`}>
        {formatARS(row.balance)}
      </span>
    ),
  },
]

export function FacturasProvClient() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<SupplierInvoice[] | null>(null)
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [status, setStatus]     = useState<SupplierInvoiceStatus | ''>('')
  const [error, setError]       = useState<string | null>(null)

  const debouncedSearch = useDebouncedValue(search, 300)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (status) params.set('status', status)
    ;(async () => {
      try {
        const d = await fetchJson<{ data: SupplierInvoice[]; total: number }>(
          `/api/v1/purchases/supplier-invoices?${params}`,
          { signal: controller.signal },
        )
        setInvoices(d.data ?? [])
        setTotal(d.total ?? 0)
        setError(null)
      } catch (e) {
        if (controller.signal.aborted) return
        setError(getApiErrorMessage(e))
        setInvoices([])
        setTotal(0)
      }
    })()
    return () => { controller.abort() }
  }, [page, debouncedSearch, status])

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Compras', href: '/compras' }, { label: 'Facturas proveedor' }]}
        actions={
          <Button size="sm" onClick={() => router.push('/compras/facturas/nueva')}>
            Nueva factura
          </Button>
        }
      />
      <ComprasSubNav />

      <PageBody>
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <DataTable
          columns={COLUMNS}
          data={invoices}
          keyExtractor={row => row.id}
          onRowClick={row => router.push(`/compras/facturas/${row.id}`)}
          emptyMessage="No hay facturas de proveedor"
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
                onChange={e => { setStatus(e.target.value as SupplierInvoiceStatus | ''); setPage(1) }}
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
