'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, TablePagination, SalesDocumentNumber, type Column } from '@/components/erp'
import { StatusBadge } from '@/components/primitives/Badge'
import { formatARS } from '@/components/primitives/CurrencyInput'
import type { Invoice } from '../types'
import { INVOICE_STATUS_LABEL } from '../types'
import { VentasSubNav } from '../VentasSubNav'
import { FacturasStatusNav, type FacturasStatusTab } from './FacturasStatusNav'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { useDebouncedValue } from '@/lib/use-debounced-value'

const PAGE_SIZE = 20

const EMPTY_STATUS_COUNTS: Record<FacturasStatusTab, number> = {
  '': 0,
  draft: 0,
  issued: 0,
  partially_paid: 0,
  paid: 0,
  cancelled: 0,
}

const COLUMNS: Column<Invoice>[] = [
  {
    key: 'invoice_number',
    header: 'N°',
    render: row => (
      <SalesDocumentNumber
        internalNumber={row.invoice_number}
        afip_status={row.afip_status}
        punto_venta={row.punto_venta}
        cbte_numero={row.cbte_numero}
      />
    ),
  },
  {
    key: 'branch',
    header: 'Sucursal',
    render: row =>
      row.branch ? (
        <span className="text-[12px] text-fg-muted">
          {String(row.branch.branch_code).padStart(2, '0')} — {row.branch.name}
        </span>
      ) : (
        <span className="text-fg-subtle">—</span>
      ),
  },
  {
    key: 'contact',
    header: 'Cliente',
    sortable: true,
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
    render: row => <StatusBadge value={INVOICE_STATUS_LABEL[row.status]} />,
  },
  {
    key: 'issue_date',
    header: 'Fecha emisión',
    sortable: true,
    render: row =>
      row.issue_date
        ? new Date(row.issue_date).toLocaleDateString('es-AR')
        : <span className="text-fg-subtle">—</span>,
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
    key: 'salesperson',
    header: 'Vendedor',
    render: row => row.salesperson
      ? <span className="text-[12px] text-fg-muted">{row.salesperson.name}</span>
      : <span className="text-fg-subtle">—</span>,
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
        <span className={`tabular-nums font-medium ${balance > 0 ? 'text-danger' : 'text-success'}`}>
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
  const [statusCounts, setStatusCounts] = useState(EMPTY_STATUS_COUNTS)
  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [statusTab, setStatusTab] = useState<FacturasStatusTab>('')
  const [listError, setListError] = useState<string | null>(null)

  const debouncedSearch = useDebouncedValue(search, 300)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({
      page:  String(page),
      limit: String(PAGE_SIZE),
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(statusTab ? { status: statusTab } : {}),
    })
    ;(async () => {
      setListError(null)
      try {
        const data = await fetchJson<{ data: Invoice[]; total: number }>(
          `/api/v1/sales/invoices?${params}`,
          { signal: controller.signal },
        )
        const rows = Array.isArray(data?.data) ? data.data : []
        const nextTotal = typeof data?.total === 'number' ? data.total : 0
        setInvoices(rows)
        setTotal(nextTotal)
        const pages = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE))
        setPage(p => (p > pages ? pages : p))
      } catch (e) {
        if (controller.signal.aborted) return
        setListError(getApiErrorMessage(e))
        setInvoices([])
        setTotal(0)
      }
    })()
    return () => { controller.abort() }
  }, [page, debouncedSearch, statusTab])

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    })
    void (async () => {
      try {
        const res = await fetchJson<{ data: Record<FacturasStatusTab, number> }>(
          `/api/v1/sales/invoices/status-counts?${params}`,
          { signal: controller.signal },
        )
        setStatusCounts({ ...EMPTY_STATUS_COUNTS, ...(res.data ?? {}) })
      } catch {
        if (controller.signal.aborted) return
        setStatusCounts(EMPTY_STATUS_COUNTS)
      }
    })()
    return () => { controller.abort() }
  }, [debouncedSearch])

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Ventas', href: '/ventas/presupuestos' }, { label: 'Facturas' }]}
      />
      <VentasSubNav />
      <FacturasStatusNav
        active={statusTab}
        counts={statusCounts}
        onChange={tab => { setStatusTab(tab); setPage(1) }}
      />

      <PageBody>
        {listError && (
          <div className="mb-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
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
                <svg className="absolute left-2 text-fg-subtle pointer-events-none" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/>
                </svg>
                <input
                  className="pl-7 pr-3 h-[30px] text-[13px] border border-border-strong rounded-sm w-full sm:w-52 bg-surface focus:outline-none focus:border-ring"
                  placeholder="Buscar por cliente o número…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
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
