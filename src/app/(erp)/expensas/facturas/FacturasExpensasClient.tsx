'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { StatusBadge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { ExpensasSubNav } from '../ExpensasSubNav'
import type { Expense, ExpenseStatus } from '../types'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { EXPENSE_STATUS_LABEL } from '../types'

const PAGE_SIZE = 20

const STATUS_OPTIONS: { value: ExpenseStatus | ''; label: string }[] = [
  { value: '',               label: 'Todos los estados' },
  { value: 'draft',          label: 'Borrador' },
  { value: 'received',       label: 'Recibido' },
  { value: 'partially_paid', label: 'Pago parcial' },
  { value: 'paid',           label: 'Pagado' },
  { value: 'cancelled',      label: 'Cancelado' },
]

const COLUMNS: Column<Expense>[] = [
  {
    key: 'expense_number',
    header: 'N°',
    render: row => <span className="font-mono text-[12px] text-fg-muted">{row.expense_number}</span>,
  },
  {
    key: 'description',
    header: 'Descripción',
    render: row => <span className="font-medium text-fg">{row.description}</span>,
  },
  {
    key: 'contact',
    header: 'Proveedor',
    render: row =>
      row.contact ? (
        <span className="text-fg-muted">{row.contact.legal_name}</span>
      ) : (
        <span className="text-fg-subtle">—</span>
      ),
  },
  {
    key: 'status',
    header: 'Estado',
    render: row => <StatusBadge value={EXPENSE_STATUS_LABEL[row.status]} />,
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

export function FacturasExpensasClient() {
  const router = useRouter()
  const [expenses, setExpenses] = useState<Expense[] | null>(null)
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [status, setStatus]     = useState<ExpenseStatus | ''>('')
  const [error, setError]       = useState<string | null>(null)

  const debouncedSearch = useDebouncedValue(search, 300)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (status) params.set('status', status)
    ;(async () => {
      try {
        const d = await fetchJson<{ data: Expense[]; total: number }>(
          `/api/v1/expenses/expense-invoices?${params}`,
          { signal: controller.signal },
        )
        setExpenses(d.data ?? [])
        setTotal(d.total ?? 0)
        setError(null)
      } catch (e) {
        if (controller.signal.aborted) return
        setError(getApiErrorMessage(e))
        setExpenses([])
        setTotal(0)
      }
    })()
    return () => { controller.abort() }
  }, [page, debouncedSearch, status])

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Expensas', href: '/expensas' }, { label: 'Facturas' }]}
        actions={
          <Button size="sm" onClick={() => router.push('/expensas/facturas/nueva')}>
            Nuevo gasto
          </Button>
        }
      />
      <ExpensasSubNav />

      <PageBody>
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <DataTable
          columns={COLUMNS}
          data={expenses}
          keyExtractor={row => row.id}
          onRowClick={row => router.push(`/expensas/facturas/${row.id}`)}
          emptyMessage="No hay gastos cargados"
          toolbar={
            <>
              <div className="relative flex items-center w-full sm:w-auto">
                <svg className="absolute left-2 text-fg-subtle pointer-events-none" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/>
                </svg>
                <input
                  type="text"
                  placeholder="Buscar por número o descripción…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  className="pl-7 pr-3 h-[30px] text-[13px] border border-border-strong rounded-sm w-full sm:w-64 bg-surface focus:outline-none focus:border-ring"
                />
              </div>
              <select
                value={status}
                onChange={e => { setStatus(e.target.value as ExpenseStatus | ''); setPage(1) }}
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
