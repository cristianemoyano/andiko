'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { StatusBadge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import type { Expense, ExpenseKind, ExpenseStatus } from './types'
import { EXPENSE_KIND_LABEL, EXPENSE_STATUS_LABEL } from './types'

const PAGE_SIZE = 20

type TabKey = 'active' | 'archive'

const TAB_STATUSES: Record<TabKey, ExpenseStatus[]> = {
  active:  ['received', 'partially_paid', 'paid'],
  archive: ['draft', 'cancelled'],
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'active',  label: 'Activos' },
  { key: 'archive', label: 'Borradores y anulados' },
]

const STATUS_OPTIONS_BY_TAB: Record<TabKey, { value: ExpenseStatus | ''; label: string }[]> = {
  active: [
    { value: '',               label: 'Todos' },
    { value: 'received',       label: 'Confirmado' },
    { value: 'partially_paid', label: 'Pago parcial' },
    { value: 'paid',           label: 'Pagado' },
  ],
  archive: [
    { value: '',          label: 'Todos' },
    { value: 'draft',     label: 'Borrador' },
    { value: 'cancelled', label: 'Anulado' },
  ],
}

const KIND_OPTIONS: { value: ExpenseKind | ''; label: string }[] = [
  { value: '',                     label: 'Todos los tipos' },
  { value: 'one_off',              label: 'Único' },
  { value: 'recurring_occurrence', label: 'Recurrente' },
  { value: 'installment_plan',     label: 'Plan / cuotas' },
]

function parseKindParam(raw: string | null): ExpenseKind | '' {
  if (raw === 'one_off' || raw === 'recurring_occurrence' || raw === 'installment_plan') return raw
  return ''
}

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
    key: 'kind',
    header: 'Tipo',
    render: row => (
      <span className="text-[12px] text-fg-muted">{EXPENSE_KIND_LABEL[row.kind] ?? row.kind}</span>
    ),
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

export function GastosExpensasClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [expenses, setExpenses] = useState<Expense[] | null>(null)
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [tab, setTab]           = useState<TabKey>('active')
  const [status, setStatus]     = useState<ExpenseStatus | ''>('')
  const kind = parseKindParam(searchParams.get('kind'))
  const [error, setError]       = useState<string | null>(null)

  const debouncedSearch = useDebouncedValue(search, 300)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (status) params.set('status', status)
    else params.set('statuses', TAB_STATUSES[tab].join(','))
    if (kind) params.set('kind', kind)
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
  }, [page, debouncedSearch, status, tab, kind])

  function selectTab(next: TabKey) {
    if (next === tab) return
    setTab(next)
    setStatus('')
    setPage(1)
  }

  function updateKind(next: ExpenseKind | '') {
    setPage(1)
    const url = new URL(window.location.href)
    if (next) url.searchParams.set('kind', next)
    else url.searchParams.delete('kind')
    router.replace(url.pathname + url.search)
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Expensas' }]}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => router.push('/expensas/tarjetas')}>
              Tarjetas
            </Button>
            <Button size="sm" variant="secondary" onClick={() => router.push('/expensas/reportes')}>
              Reportes
            </Button>
            <Button size="sm" onClick={() => router.push('/expensas/nueva')}>
              Nuevo gasto
            </Button>
          </div>
        }
      />

      <PageBody>
        <div className="mb-4 flex items-center gap-1 border-b border-border">
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => selectTab(t.key)}
              className={`-mb-px border-b-2 px-4 py-2 text-[13px] transition-colors ${
                tab === t.key
                  ? 'border-teal-600 text-teal-700 font-medium'
                  : 'border-transparent text-fg-muted hover:text-fg'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <DataTable
          columns={COLUMNS}
          data={expenses}
          keyExtractor={row => row.id}
          onRowClick={row => router.push(`/expensas/${row.id}`)}
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
                value={kind}
                onChange={e => updateKind(e.target.value as ExpenseKind | '')}
                className="h-[30px] text-[13px] border border-border-strong rounded-sm px-2 bg-surface focus:outline-none focus:border-ring text-fg-muted"
              >
                {KIND_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <select
                value={status}
                onChange={e => { setStatus(e.target.value as ExpenseStatus | ''); setPage(1) }}
                className="h-[30px] text-[13px] border border-border-strong rounded-sm px-2 bg-surface focus:outline-none focus:border-ring text-fg-muted"
              >
                {STATUS_OPTIONS_BY_TAB[tab].map(o => (
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
