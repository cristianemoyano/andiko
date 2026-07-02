'use client'

import { useEffect, useMemo, useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { StatusBadge } from '@/components/primitives/Badge'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { ComprasSubNav } from '../ComprasSubNav'
import type {
  AccountDebtStatus,
  AccountStatementLine,
  AccountStatementResponse,
  AccountStatementSummary,
} from '../../ventas/types'
import {
  ACCOUNT_DEBT_STATUS_LABEL,
  ACCOUNT_MOVEMENT_TYPE_LABEL,
} from '../../ventas/types'
import { fetchJson } from '@/lib/fetch-json'

const CONTACT_PAGE_SIZE = 20
const LINE_PAGE_SIZE = 20

type SupplierStatementSummaryApiRow = {
  contact_id: string
  legal_name: string
  trade_name: string | null
  cuit: string | null
  invoices_count: number
  total_invoiced: string
  total_paid: string
  balance: string
  overdue_balance: string
  debt_status: AccountDebtStatus
}

type ContactStatementRow = {
  id: string
  legal_name: string
  trade_name: string | null
  summary: AccountStatementSummary
}

function toSummary(row: SupplierStatementSummaryApiRow): AccountStatementSummary {
  const balance = Number(row.balance)
  const overdue = Number(row.overdue_balance)
  return {
    currency: 'ARS',
    total_invoiced: row.total_invoiced,
    total_paid: row.total_paid,
    balance: row.balance,
    overdue_balance: row.overdue_balance,
    current_balance: (balance - overdue).toFixed(2),
    debt_status: row.debt_status,
  }
}

const DEFAULT_SUMMARY: AccountStatementSummary = {
  currency: 'ARS',
  total_invoiced: '0.00',
  total_paid: '0.00',
  balance: '0.00',
  overdue_balance: '0.00',
  current_balance: '0.00',
  debt_status: 'up_to_date',
}

const DEBT_FILTER_OPTIONS: Array<{ value: '' | AccountDebtStatus; label: string }> = [
  { value: '', label: 'Todos los proveedores' },
  { value: 'up_to_date', label: 'Al día' },
  { value: 'with_balance', label: 'Con saldo' },
  { value: 'overdue', label: 'Vencidos' },
]

const MOVEMENT_TYPE_FILTER_OPTIONS: Array<{ value: '' | 'invoice' | 'payment'; label: string }> = [
  { value: '', label: 'Todos los movimientos' },
  { value: 'invoice', label: 'Facturas' },
  { value: 'payment', label: 'Pagos' },
]

const BASE_CONTACT_COLUMNS: Column<ContactStatementRow>[] = [
  {
    key: 'supplier',
    header: 'Proveedor',
    render: row => (
      <div className="min-w-0">
        <p className="font-medium text-fg truncate">{row.legal_name}</p>
        {row.trade_name ? <p className="text-[12px] text-fg-muted truncate">{row.trade_name}</p> : null}
      </div>
    ),
  },
  {
    key: 'debt_status',
    header: 'Estado',
    render: row => <StatusBadge value={ACCOUNT_DEBT_STATUS_LABEL[row.summary.debt_status]} />,
  },
  {
    key: 'balance',
    header: 'Saldo',
    align: 'right',
    render: row => {
      const balance = Number(row.summary.balance)
      return (
        <span className={`tabular-nums font-medium ${balance > 0 ? 'text-danger' : 'text-success'}`}>
          {formatARS(row.summary.balance)}
        </span>
      )
    },
  },
  {
    key: 'overdue_balance',
    header: 'Vencido',
    align: 'right',
    render: row => (
      <span className="tabular-nums text-fg-muted">{formatARS(row.summary.overdue_balance)}</span>
    ),
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
    render: row => ACCOUNT_MOVEMENT_TYPE_LABEL[row.movement_type],
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

export function CuentaCorrienteProveedorClient() {
  const [contactRows, setContactRows] = useState<ContactStatementRow[]>([])
  const [contactsTotal, setContactsTotal] = useState(0)
  const [contactsPage, setContactsPage] = useState(1)
  const [contactSearch, setContactSearch] = useState('')
  const [debtStatusFilter, setDebtStatusFilter] = useState<'' | AccountDebtStatus>('')

  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [selectedSummary, setSelectedSummary] = useState<AccountStatementSummary>(DEFAULT_SUMMARY)

  const [lineItems, setLineItems] = useState<AccountStatementLine[]>([])
  const [lineTotal, setLineTotal] = useState(0)
  const [linePage, setLinePage] = useState(1)
  const [lineSearch, setLineSearch] = useState('')
  const [lineTypeFilter, setLineTypeFilter] = useState<'' | 'invoice' | 'payment'>('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadContacts() {
      const params = new URLSearchParams({
        page: String(contactsPage),
        limit: String(CONTACT_PAGE_SIZE),
        only_with_balance: 'false',
        ...(contactSearch ? { search: contactSearch } : {}),
      })
      let payload: { data: SupplierStatementSummaryApiRow[]; total: number }
      try {
        payload = await fetchJson<{ data: SupplierStatementSummaryApiRow[]; total: number }>(
          `/api/v1/purchases/account-statements?${params}`,
        )
      } catch {
        if (cancelled) return
        setContactRows([])
        setContactsTotal(0)
        setSelectedContactId(null)
        return
      }
      if (cancelled) return

      const sourceRows = Array.isArray(payload?.data) ? payload.data : []
      const mappedRows: ContactStatementRow[] = sourceRows.map(row => ({
        id: row.contact_id,
        legal_name: row.legal_name,
        trade_name: row.trade_name,
        summary: toSummary(row),
      }))

      setContactRows(mappedRows)
      setContactsTotal(typeof payload?.total === 'number' ? payload.total : mappedRows.length)

      if (!selectedContactId || !mappedRows.some(row => row.id === selectedContactId)) {
        const nextSelected = mappedRows[0]?.id ?? null
        setSelectedContactId(nextSelected)
        setLinePage(1)
      }
    }

    void loadContacts()
    return () => { cancelled = true }
  }, [contactsPage, contactSearch, selectedContactId])

  useEffect(() => {
    if (!selectedContactId) {
      queueMicrotask(() => {
        setLineItems([])
        setLineTotal(0)
        setSelectedSummary(DEFAULT_SUMMARY)
      })
      return
    }

    let cancelled = false
    async function loadStatement() {
      const params = new URLSearchParams({
        page: String(linePage),
        limit: String(LINE_PAGE_SIZE),
        ...(lineSearch ? { search: lineSearch } : {}),
        ...(lineTypeFilter ? { movement_type: lineTypeFilter } : {}),
        ...(fromDate ? { from: fromDate } : {}),
        ...(toDate ? { to: toDate } : {}),
      })
      let payload: AccountStatementResponse
      try {
        payload = await fetchJson<AccountStatementResponse>(
          `/api/v1/purchases/contacts/${selectedContactId}/account-statement?${params}`,
        )
      } catch {
        return
      }
      if (cancelled) return

      const rows = Array.isArray(payload?.data) ? payload.data : []
      const total = typeof payload?.total === 'number' ? payload.total : 0
      setLineItems(rows)
      setLineTotal(total)
      setSelectedSummary(payload.summary ?? DEFAULT_SUMMARY)
    }

    void loadStatement()
    return () => { cancelled = true }
  }, [selectedContactId, linePage, lineSearch, lineTypeFilter, fromDate, toDate])

  const selectedContact = useMemo(
    () => contactRows.find(row => row.id === selectedContactId) ?? null,
    [contactRows, selectedContactId],
  )

  const visibleContactRows = useMemo(() => (
    debtStatusFilter
      ? contactRows.filter(row => row.summary.debt_status === debtStatusFilter)
      : contactRows
  ), [contactRows, debtStatusFilter])

  const contactColumns = useMemo<Column<ContactStatementRow>[]>(() => ([
    {
      key: 'selected',
      header: '',
      className: 'w-6',
      render: row => (
        <span
          className={`inline-block h-2 w-2 rounded-full ${row.id === selectedContactId ? 'bg-blue-600' : 'bg-transparent'}`}
          aria-hidden
        />
      ),
    },
    ...BASE_CONTACT_COLUMNS,
  ]), [selectedContactId])

  return (
    <div className="flex h-full flex-col">
      <TopBar breadcrumbs={[{ label: 'Compras', href: '/compras/ordenes' }, { label: 'Cuenta corriente' }]} />
      <ComprasSubNav />

      <PageBody>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(360px,420px)_1fr]">
          <DataTable
            columns={contactColumns}
            data={visibleContactRows}
            keyExtractor={row => row.id}
            onRowClick={(row) => {
              setSelectedContactId(row.id)
              setSelectedSummary(row.summary)
              setLinePage(1)
            }}
            emptyMessage="No hay proveedores para mostrar."
            toolbar={
              <>
                <div className="relative flex w-full items-center sm:w-auto">
                  <svg className="pointer-events-none absolute left-2 text-fg-subtle" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="7" cy="7" r="4.5" />
                    <path d="M10.5 10.5l3 3" />
                  </svg>
                  <input
                    className="h-[30px] w-full rounded-sm border border-border-strong bg-surface pl-7 pr-3 text-[13px] focus:border-ring focus:outline-none sm:w-44"
                    placeholder="Buscar proveedor..."
                    value={contactSearch}
                    onChange={(e) => {
                      setContactSearch(e.target.value)
                      setContactsPage(1)
                    }}
                  />
                </div>
                <select
                  className="h-[30px] rounded-sm border border-border-strong bg-surface px-2 text-[13px] text-fg-muted focus:border-ring focus:outline-none"
                  value={debtStatusFilter}
                  onChange={(e) => {
                    setDebtStatusFilter(e.target.value as '' | AccountDebtStatus)
                    setContactsPage(1)
                  }}
                >
                  {DEBT_FILTER_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <span className="flex-1" />
                <span className="text-[12px] text-fg-muted">{visibleContactRows.length} proveedor{visibleContactRows.length !== 1 ? 'es' : ''}</span>
              </>
            }
            footer={
              contactsTotal > 0 ? (
                <TablePagination
                  page={contactsPage}
                  pageSize={CONTACT_PAGE_SIZE}
                  total={contactsTotal}
                  onPageChange={setContactsPage}
                />
              ) : undefined
            }
          />

          <div className="space-y-4">
            <div className="rounded border border-border bg-surface p-4">
              <p className="text-[12px] uppercase tracking-wide text-fg-muted">Proveedor seleccionado</p>
              <h2 className="mt-1 text-[20px] font-semibold text-fg">{selectedContact?.legal_name ?? 'Seleccioná un proveedor'}</h2>
              {selectedContact?.trade_name ? <p className="text-[13px] text-fg-muted">{selectedContact.trade_name}</p> : null}
              <div className="mt-3 flex items-center gap-2">
                <StatusBadge value={ACCOUNT_DEBT_STATUS_LABEL[selectedSummary.debt_status]} />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryMetric label="Saldo" value={selectedSummary.balance} emphasis />
                <SummaryMetric label="Vencido" value={selectedSummary.overdue_balance} />
                <SummaryMetric label="Facturado" value={selectedSummary.total_invoiced} />
                <SummaryMetric label="Pagado" value={selectedSummary.total_paid} />
              </div>
            </div>

            <DataTable
              columns={MOVEMENT_COLUMNS}
              data={lineItems}
              keyExtractor={row => row.id}
              emptyMessage="No hay movimientos para este proveedor."
              toolbar={
                <>
                  <div className="relative flex w-full items-center sm:w-auto">
                    <svg className="pointer-events-none absolute left-2 text-fg-subtle" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <circle cx="7" cy="7" r="4.5" />
                      <path d="M10.5 10.5l3 3" />
                    </svg>
                    <input
                      className="h-[30px] w-full rounded-sm border border-border-strong bg-surface pl-7 pr-3 text-[13px] focus:border-ring focus:outline-none sm:w-48"
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
                      setLineTypeFilter(e.target.value as '' | 'invoice' | 'payment')
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
        </div>
      </PageBody>
    </div>
  )
}

function SummaryMetric({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="rounded border border-border bg-surface-muted p-3">
      <p className="text-[12px] text-fg-muted">{label}</p>
      <p className={`tabular-nums text-[16px] font-semibold ${emphasis ? 'text-fg' : 'text-fg-muted'}`}>
        {formatARS(value)}
      </p>
    </div>
  )
}
