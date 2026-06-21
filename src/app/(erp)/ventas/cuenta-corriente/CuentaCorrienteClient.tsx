'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { Button } from '@/components/primitives/Button'
import { StatusBadge } from '@/components/primitives/Badge'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { VentasSubNav } from '../VentasSubNav'
import type {
  AccountStatementLine,
  AccountStatementResponse,
  AccountStatementSummary,
  AccountStatementSummaryRow,
} from '../types'
import {
  ACCOUNT_DEBT_STATUS_LABEL,
  ACCOUNT_MOVEMENT_TYPE_LABEL,
} from '../types'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

const SUMMARY_PAGE_SIZE = 20
const LINE_PAGE_SIZE = 20

const DEFAULT_SUMMARY: AccountStatementSummary = {
  currency: 'ARS',
  total_invoiced: '0.00',
  total_paid: '0.00',
  balance: '0.00',
  overdue_balance: '0.00',
  current_balance: '0.00',
  debt_status: 'up_to_date',
}

const BALANCE_FILTER_OPTIONS: Array<{ value: 'with_balance' | 'all'; label: string }> = [
  { value: 'with_balance', label: 'Con saldo' },
  { value: 'all', label: 'Todos los clientes' },
]

const MOVEMENT_TYPE_FILTER_OPTIONS: Array<{ value: '' | 'invoice' | 'payment' | 'credit_note'; label: string }> = [
  { value: '', label: 'Todos los movimientos' },
  { value: 'invoice', label: 'Facturas' },
  { value: 'payment', label: 'Cobros' },
  { value: 'credit_note', label: 'Notas de crédito' },
]

const SUMMARY_COLUMNS: Column<AccountStatementSummaryRow>[] = [
  {
    key: 'customer',
    header: 'Cliente',
    render: row => (
      <div className="min-w-0">
        <p
          className="font-medium text-fg truncate"
          data-testid="account-statement-row"
          data-customer-name={row.legal_name}
        >
          {row.legal_name}
        </p>
        {row.trade_name ? <p className="text-[12px] text-fg-muted truncate">{row.trade_name}</p> : null}
      </div>
    ),
  },
  {
    key: 'cuit',
    header: 'CUIT',
    render: row => row.cuit
      ? <span className="font-mono text-[12px] text-fg-muted">{row.cuit}</span>
      : <span className="text-fg-subtle">—</span>,
  },
  {
    key: 'debt_status',
    header: 'Estado',
    render: row => <StatusBadge value={ACCOUNT_DEBT_STATUS_LABEL[row.debt_status]} />,
  },
  {
    key: 'total_invoiced',
    header: 'Facturado',
    align: 'right',
    render: row => (
      <span className="tabular-nums text-fg-muted">{formatARS(row.total_invoiced)}</span>
    ),
  },
  {
    key: 'balance',
    header: 'Saldo',
    align: 'right',
    render: row => {
      const balance = Number(row.balance)
      return (
        <span className={`tabular-nums font-medium ${balance > 0 ? 'text-danger' : 'text-success'}`}>
          {formatARS(row.balance)}
        </span>
      )
    },
  },
  {
    key: 'overdue_balance',
    header: 'Vencido',
    align: 'right',
    render: row => {
      const overdue = Number(row.overdue_balance)
      return (
        <span className={`tabular-nums ${overdue > 0 ? 'font-medium text-danger' : 'text-fg-muted'}`}>
          {formatARS(row.overdue_balance)}
        </span>
      )
    },
  },
]

const MOVEMENT_COLUMNS: Column<AccountStatementLine>[] = [
  {
    key: 'date',
    header: 'Fecha',
    render: row => new Date(row.date).toLocaleDateString('es-AR'),
  },
  {
    key: 'movement_type',
    header: 'Tipo',
    render: row => (
      <span data-testid="account-movement-row" data-movement-type={row.movement_type}>
        {ACCOUNT_MOVEMENT_TYPE_LABEL[row.movement_type]}
      </span>
    ),
  },
  {
    key: 'document_number',
    header: 'Comprobante',
    render: row => (
      <div className="min-w-0">
        <p className="font-mono text-[12px] text-fg-muted">{row.document_number}</p>
        {row.description ? <p className="text-[12px] text-fg-muted truncate">{row.description}</p> : null}
      </div>
    ),
  },
  {
    key: 'due_date',
    header: 'Vencimiento',
    render: row => (
      row.due_date ? (
        <span
          className="tabular-nums text-[12px] text-fg-muted"
          {...(row.movement_type === 'invoice' ? { 'data-testid': 'due-date' } : {})}
        >
          {new Date(row.due_date).toLocaleDateString('es-AR')}
        </span>
      ) : (
        <span className="text-fg-subtle">—</span>
      )
    ),
  },
  {
    key: 'debit',
    header: 'Debe',
    align: 'right',
    render: row => (
      <span className="tabular-nums text-fg-muted">{Number(row.debit) > 0 ? formatARS(row.debit) : '—'}</span>
    ),
  },
  {
    key: 'credit',
    header: 'Haber',
    align: 'right',
    render: row => (
      <span className="tabular-nums text-fg-muted">{Number(row.credit) > 0 ? formatARS(row.credit) : '—'}</span>
    ),
  },
  {
    key: 'running_balance',
    header: 'Saldo',
    align: 'right',
    render: row => {
      const running = Number(row.running_balance)
      return (
        <span className={`tabular-nums font-medium ${running > 0 ? 'text-danger' : 'text-success'}`}>
          {formatARS(row.running_balance)}
        </span>
      )
    },
  },
]

export function CuentaCorrienteClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedContactId = searchParams.get('contact_id')

  return (
    <div className="flex h-full flex-col">
      <TopBar breadcrumbs={[{ label: 'Ventas', href: '/ventas/presupuestos' }, { label: 'Cuenta corriente' }]} />
      <VentasSubNav />

      <div className="flex-1 overflow-auto p-5">
        {selectedContactId ? (
          <StatementDetail
            contactId={selectedContactId}
            onBack={() => router.push('/ventas/cuenta-corriente')}
          />
        ) : (
          <SummaryList
            onSelect={(contactId) => router.push(`/ventas/cuenta-corriente?contact_id=${contactId}`)}
          />
        )}
      </div>
    </div>
  )
}

function SummaryList({ onSelect }: { onSelect: (contactId: string) => void }) {
  const [rows, setRows] = useState<AccountStatementSummaryRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [balanceFilter, setBalanceFilter] = useState<'with_balance' | 'all'>('with_balance')
  const [listError, setListError] = useState<string | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(id)
  }, [search])

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({
      page: String(page),
      limit: String(SUMMARY_PAGE_SIZE),
      only_with_balance: balanceFilter === 'with_balance' ? 'true' : 'false',
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    })
    ;(async () => {
      setListError(null)
      try {
        const payload = await fetchJson<{ data: AccountStatementSummaryRow[]; total: number }>(
          `/api/v1/sales/account-statements?${params}`,
        )
        if (cancelled) return
        setRows(Array.isArray(payload?.data) ? payload.data : [])
        setTotal(typeof payload?.total === 'number' ? payload.total : 0)
      } catch (e) {
        if (cancelled) return
        setListError(getApiErrorMessage(e))
        setRows([])
        setTotal(0)
      }
    })()
    return () => { cancelled = true }
  }, [page, debouncedSearch, balanceFilter])

  return (
    <div className="space-y-3">
      {listError && (
        <div className="rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
          {listError}
        </div>
      )}
      <DataTable
        columns={SUMMARY_COLUMNS}
        data={rows}
        keyExtractor={row => row.contact_id}
        onRowClick={row => onSelect(row.contact_id)}
        emptyMessage={
          balanceFilter === 'with_balance'
            ? 'No hay clientes con saldo pendiente.'
            : 'No hay clientes con facturación registrada.'
        }
        toolbar={
          <>
            <div className="relative flex items-center w-full sm:w-auto">
              <svg className="pointer-events-none absolute left-2 text-fg-subtle" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="7" cy="7" r="4.5" />
                <path d="M10.5 10.5l3 3" />
              </svg>
              <input
                data-testid="account-statement-search"
                className="h-[30px] w-full sm:w-56 rounded-sm border border-border-strong bg-surface pl-7 pr-3 text-[13px] focus:border-ring focus:outline-none"
                placeholder="Buscar por cliente o CUIT…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </div>
            <select
              data-testid="account-statement-balance-filter"
              className="h-[30px] rounded-sm border border-border-strong bg-surface px-2 text-[13px] text-fg-muted focus:border-ring focus:outline-none"
              value={balanceFilter}
              onChange={(e) => {
                setBalanceFilter(e.target.value as 'with_balance' | 'all')
                setPage(1)
              }}
            >
              {BALANCE_FILTER_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <span className="flex-1" />
            <span className="text-[12px] text-fg-muted">{total} cliente{total !== 1 ? 's' : ''}</span>
          </>
        }
        footer={
          total > 0 ? (
            <TablePagination
              page={page}
              pageSize={SUMMARY_PAGE_SIZE}
              total={total}
              onPageChange={setPage}
            />
          ) : undefined
        }
      />
    </div>
  )
}

function StatementDetail({ contactId, onBack }: { contactId: string; onBack: () => void }) {
  const [contact, setContact] = useState<AccountStatementResponse['contact'] | null>(null)
  const [summary, setSummary] = useState<AccountStatementSummary>(DEFAULT_SUMMARY)
  const [lineItems, setLineItems] = useState<AccountStatementLine[]>([])
  const [lineTotal, setLineTotal] = useState(0)
  const [linePage, setLinePage] = useState(1)
  const [lineSearch, setLineSearch] = useState('')
  const [lineTypeFilter, setLineTypeFilter] = useState<'' | 'invoice' | 'payment' | 'credit_note'>('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [detailError, setDetailError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({
      page: String(linePage),
      limit: String(LINE_PAGE_SIZE),
      ...(lineSearch ? { search: lineSearch } : {}),
      ...(lineTypeFilter ? { movement_type: lineTypeFilter } : {}),
      ...(fromDate ? { from: fromDate } : {}),
      ...(toDate ? { to: toDate } : {}),
    })
    ;(async () => {
      setDetailError(null)
      try {
        const payload = await fetchJson<AccountStatementResponse>(
          `/api/v1/sales/contacts/${contactId}/account-statement?${params}`,
        )
        if (cancelled) return
        setContact(payload.contact ?? null)
        setSummary(payload.summary ?? DEFAULT_SUMMARY)
        setLineItems(Array.isArray(payload?.data) ? payload.data : [])
        setLineTotal(typeof payload?.total === 'number' ? payload.total : 0)
      } catch (e) {
        if (cancelled) return
        setDetailError(getApiErrorMessage(e))
        setLineItems([])
        setLineTotal(0)
      }
    })()
    return () => { cancelled = true }
  }, [contactId, linePage, lineSearch, lineTypeFilter, fromDate, toDate])

  return (
    <div className="space-y-4">
      {detailError && (
        <div className="rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
          {detailError}
        </div>
      )}

      <div className="rounded border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[12px] uppercase tracking-wide text-fg-muted">Cuenta corriente</p>
            <h2 className="mt-1 text-[20px] font-semibold text-fg">{contact?.legal_name ?? '—'}</h2>
            {contact?.trade_name ? <p className="text-[13px] text-fg-muted">{contact.trade_name}</p> : null}
            <div className="mt-3 flex items-center gap-2">
              <StatusBadge value={ACCOUNT_DEBT_STATUS_LABEL[summary.debt_status]} />
            </div>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={onBack}>
            ← Volver al listado
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryMetric label="Saldo" value={summary.balance} emphasis testId="customer-debt" />
          <SummaryMetric label="Vencido" value={summary.overdue_balance} testId="customer-overdue-balance" />
          <SummaryMetric label="Facturado" value={summary.total_invoiced} />
          <SummaryMetric label="Cobrado" value={summary.total_paid} />
        </div>
      </div>

      <DataTable
        columns={MOVEMENT_COLUMNS}
        data={lineItems}
        keyExtractor={row => row.id}
        emptyMessage="No hay movimientos para este cliente."
        toolbar={
          <>
            <div className="relative flex items-center">
              <svg className="pointer-events-none absolute left-2 text-fg-subtle" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="7" cy="7" r="4.5" />
                <path d="M10.5 10.5l3 3" />
              </svg>
              <input
                className="h-[30px] w-48 rounded-sm border border-border-strong bg-surface pl-7 pr-3 text-[13px] focus:border-ring focus:outline-none"
                placeholder="Buscar comprobante..."
                value={lineSearch}
                onChange={(e) => {
                  setLineSearch(e.target.value)
                  setLinePage(1)
                }}
              />
            </div>
            <select
              className="h-[30px] rounded-sm border border-border-strong bg-surface px-2 text-[13px] text-fg-muted focus:border-ring focus:outline-none"
              value={lineTypeFilter}
              onChange={(e) => {
                setLineTypeFilter(e.target.value as '' | 'invoice' | 'payment' | 'credit_note')
                setLinePage(1)
              }}
            >
              {MOVEMENT_TYPE_FILTER_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input
              type="date"
              className="h-[30px] rounded-sm border border-border-strong bg-surface px-2 text-[13px] text-fg-muted focus:border-ring focus:outline-none"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value)
                setLinePage(1)
              }}
            />
            <input
              type="date"
              className="h-[30px] rounded-sm border border-border-strong bg-surface px-2 text-[13px] text-fg-muted focus:border-ring focus:outline-none"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value)
                setLinePage(1)
              }}
            />
            <span className="flex-1" />
            <span className="text-[12px] text-fg-muted">{lineTotal} movimiento{lineTotal !== 1 ? 's' : ''}</span>
          </>
        }
        footer={
          lineTotal > 0 ? (
            <TablePagination
              page={linePage}
              pageSize={LINE_PAGE_SIZE}
              total={lineTotal}
              onPageChange={setLinePage}
            />
          ) : undefined
        }
      />
    </div>
  )
}

function SummaryMetric({
  label,
  value,
  emphasis = false,
  testId,
}: {
  label: string
  value: string
  emphasis?: boolean
  testId?: string
}) {
  return (
    <div className="rounded border border-border bg-surface-muted p-3">
      <p className="text-[12px] text-fg-muted">{label}</p>
      <p
        data-testid={testId}
        className={`tabular-nums text-[16px] font-semibold ${emphasis ? 'text-fg' : 'text-fg-muted'}`}
      >
        {formatARS(value)}
      </p>
    </div>
  )
}
