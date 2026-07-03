'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { StatusBadge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { formatARS } from '@/components/primitives/CurrencyInput'
import type { Quote, QuoteStatus } from '../types'
import { QUOTE_STATUS_LABEL, PAYMENT_CONDITION_LABEL } from '../types'
import { VentasSubNav } from '../VentasSubNav'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { useDebouncedValue } from '@/lib/use-debounced-value'

const PAGE_SIZE = 20

const STATUS_OPTIONS: { value: QuoteStatus | ''; label: string }[] = [
  { value: '',         label: 'Todos los estados' },
  { value: 'draft',    label: 'Borrador' },
  { value: 'sent',     label: 'Enviado' },
  { value: 'accepted', label: 'Aceptado' },
  { value: 'rejected', label: 'Rechazado' },
  { value: 'expired',  label: 'Vencido' },
  { value: 'cancelled', label: 'Cancelado' },
]

const COLUMNS: Column<Quote>[] = [
  {
    key: 'quote_number',
    header: 'N°',
    render: row => (
      <span className="font-mono text-[12px] text-fg-muted">{row.quote_number}</span>
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
    render: row => <StatusBadge value={QUOTE_STATUS_LABEL[row.status]} />,
  },
  {
    key: 'payment_condition',
    header: 'Condición',
    render: row => PAYMENT_CONDITION_LABEL[row.payment_condition],
  },
  {
    key: 'valid_until',
    header: 'Válido hasta',
    render: row =>
      row.valid_until
        ? new Date(row.valid_until).toLocaleDateString('es-AR')
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
    key: 'created_at',
    header: 'Fecha',
    sortable: true,
    render: row => new Date(row.created_at).toLocaleDateString('es-AR'),
  },
]

const EXPIRING_SOON_DAYS = 7

export function PresupuestosClient() {
  const router = useRouter()
  const [quotes, setQuotes]   = useState<Quote[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [search, setSearch]   = useState('')
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | ''>('')
  const [expiringSoon, setExpiringSoon] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  const debouncedSearch = useDebouncedValue(search, 300)

  useEffect(() => {
    const controller = new AbortController()

    if (expiringSoon) {
      const params = new URLSearchParams({ expiring_within_days: String(EXPIRING_SOON_DAYS) })
      ;(async () => {
        setListError(null)
        try {
          const data = await fetchJson<{ data: Quote[] }>(
            `/api/v1/sales/quotes?${params}`,
            { signal: controller.signal },
          )
          const rows = Array.isArray(data?.data) ? data.data : []
          setQuotes(rows)
          setTotal(rows.length)
        } catch (e) {
          if (controller.signal.aborted) return
          setListError(getApiErrorMessage(e))
          setQuotes([])
          setTotal(0)
        }
      })()
      return () => { controller.abort() }
    }

    const params = new URLSearchParams({
      page:  String(page),
      limit: String(PAGE_SIZE),
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    })
    ;(async () => {
      setListError(null)
      try {
        const data = await fetchJson<{ data: Quote[]; total: number }>(
          `/api/v1/sales/quotes?${params}`,
          { signal: controller.signal },
        )
        const rows = Array.isArray(data?.data) ? data.data : []
        const nextTotal = typeof data?.total === 'number' ? data.total : 0
        setQuotes(rows)
        setTotal(nextTotal)
        const pages = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE))
        setPage(p => (p > pages ? pages : p))
      } catch (e) {
        if (controller.signal.aborted) return
        setListError(getApiErrorMessage(e))
        setQuotes([])
        setTotal(0)
      }
    })()
    return () => { controller.abort() }
  }, [page, debouncedSearch, statusFilter, expiringSoon])

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Ventas', href: '/ventas/presupuestos' }, { label: 'Presupuestos' }]}
        actions={
          <Button size="sm" onClick={() => router.push('/ventas/presupuestos/nuevo')}>
            + Nuevo presupuesto
          </Button>
        }
      />
      <VentasSubNav />

      <PageBody>
        {listError && (
          <div className="mb-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
            {listError}
          </div>
        )}
        <DataTable
          columns={COLUMNS}
          data={quotes}
          keyExtractor={r => r.id}
          onRowClick={row => router.push(`/ventas/presupuestos/${row.id}`)}
          emptyMessage="No hay presupuestos. Creá el primero."
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
              <select
                className="h-[30px] text-[13px] border border-border-strong rounded-sm px-2 bg-surface focus:outline-none focus:border-ring text-fg-muted"
                value={statusFilter}
                disabled={expiringSoon}
                onChange={e => { setStatusFilter(e.target.value as QuoteStatus | ''); setPage(1) }}
              >
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                aria-pressed={expiringSoon}
                className={expiringSoon ? 'bg-brand-600 text-white hover:bg-brand-600 hover:text-white' : ''}
                onClick={() => { setExpiringSoon(v => !v); setPage(1) }}
              >
                Por vencer ({EXPIRING_SOON_DAYS}d)
              </Button>
              <span className="flex-1" />
              <span className="text-[12px] text-fg-muted">{total} registro{total !== 1 ? 's' : ''}</span>
            </>
          }
          footer={
            !expiringSoon && total > 0 ? (
              <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            ) : undefined
          }
        />
      </PageBody>
    </div>
  )
}
