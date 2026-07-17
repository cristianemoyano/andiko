'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Decimal from 'decimal.js'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { SearchableSelect, type SearchableSelectOption } from '@/components/erp/SearchableSelect'
import { StatusBadge } from '@/components/primitives/Badge'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

const CONTACT_PAGE_SIZE = 20
const LINE_PAGE_SIZE = 20

type DebtStatus = 'up_to_date' | 'with_balance' | 'overdue'

const DEBT_STATUS_LABEL: Record<DebtStatus, string> = {
  up_to_date: 'Al día',
  with_balance: 'Con saldo',
  overdue: 'Vencido',
}

const MOVEMENT_TYPE_LABEL: Record<'invoice' | 'payment', string> = {
  invoice: 'Gasto',
  payment: 'Pago',
}

type AgingApiRow = {
  contact_id: string
  legal_name: string
  trade_name: string | null
  cuit: string | null
  invoices_count: number
  current: string
  balance: string
}

type AgingApiResponse = {
  data: AgingApiRow[]
  total: number
}

type StatementSummary = {
  currency: string
  total_invoiced: string
  total_paid: string
  balance: string
  overdue_balance: string
  current_balance: string
  debt_status: DebtStatus
}

type StatementLine = {
  id: string
  movement_type: 'invoice' | 'payment'
  movement_id: string
  related_id: string | null
  date: string
  document_number: string
  description: string | null
  due_date: string | null
  debit: string
  credit: string
  running_balance: string
}

type StatementResponse = {
  contact: {
    id: string
    legal_name: string
    trade_name: string | null
  }
  summary: StatementSummary
  data: StatementLine[]
  total: number
}

type ContactRow = {
  id: string
  legal_name: string
  trade_name: string | null
  balance: string
  overdue: string
}

const DEFAULT_SUMMARY: StatementSummary = {
  currency: 'ARS',
  total_invoiced: '0.00',
  total_paid: '0.00',
  balance: '0.00',
  overdue_balance: '0.00',
  current_balance: '0.00',
  debt_status: 'up_to_date',
}

const MOVEMENT_TYPE_FILTER_OPTIONS: Array<{ value: '' | 'invoice' | 'payment'; label: string }> = [
  { value: '', label: 'Todos los movimientos' },
  { value: 'invoice', label: 'Gastos' },
  { value: 'payment', label: 'Pagos' },
]

const BASE_CONTACT_COLUMNS: Column<ContactRow>[] = [
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
    key: 'overdue',
    header: 'Vencido',
    align: 'right',
    render: row => (
      <span className="tabular-nums text-fg-muted">{formatARS(row.overdue)}</span>
    ),
  },
]

function createMovementColumns(): Column<StatementLine>[] {
  return [
    {
      key: 'date',
      header: 'Fecha',
      render: row => new Date(row.date).toLocaleDateString('es-AR'),
    },
    {
      key: 'movement_type',
      header: 'Tipo',
      render: row => MOVEMENT_TYPE_LABEL[row.movement_type],
    },
    {
      key: 'document_number',
      header: 'Comprobante',
      render: row => (
        <span className="inline-flex min-w-0 flex-col">
          <span className="font-mono text-[12px] font-medium text-accent">{row.document_number}</span>
          {row.description ? (
            <span className="text-[12px] text-fg-muted truncate">{row.description}</span>
          ) : null}
        </span>
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
}

/** Resuelve la página de detalle del gasto asociado a un movimiento de la cuenta corriente. */
function getMovementHref(line: StatementLine): string | null {
  if (line.movement_type === 'invoice') return `/expensas/${line.movement_id}`
  return line.related_id ? `/expensas/${line.related_id}` : null
}

export function CuentaCorrienteExpensasClient() {
  const router = useRouter()

  const [contactRows, setContactRows] = useState<ContactRow[]>([])
  const [contactsTotal, setContactsTotal] = useState(0)
  const [contactsPage, setContactsPage] = useState(1)
  const [contactSearch, setContactSearch] = useState('')
  const [contactsError, setContactsError] = useState<string | null>(null)

  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [selectedContactName, setSelectedContactName] = useState<string | null>(null)
  const [selectedContactTradeName, setSelectedContactTradeName] = useState<string | null>(null)
  const [selectedSummary, setSelectedSummary] = useState<StatementSummary>(DEFAULT_SUMMARY)

  const [lineItems, setLineItems] = useState<StatementLine[]>([])
  const [lineTotal, setLineTotal] = useState(0)
  const [linePage, setLinePage] = useState(1)
  const [lineSearch, setLineSearch] = useState('')
  const [lineTypeFilter, setLineTypeFilter] = useState<'' | 'invoice' | 'payment'>('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [statementError, setStatementError] = useState<string | null>(null)

  const movementColumns = useMemo(() => createMovementColumns(), [])

  const selectContact = useCallback((id: string | null) => {
    setSelectedContactId(id)
    setLinePage(1)
  }, [])

  const searchSuppliers = useCallback(async (q: string): Promise<SearchableSelectOption[]> => {
    try {
      const data = await fetchJson<{ data: Array<{ id: string; legal_name: string; trade_name: string | null }> }>(
        `/api/v1/contacts?search=${encodeURIComponent(q)}&limit=20&type=supplier`,
      )
      return (data.data ?? []).map(c => ({ value: c.id, label: c.legal_name, sublabel: c.trade_name ?? undefined }))
    } catch {
      return []
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadContacts() {
      const params = new URLSearchParams({
        page: String(contactsPage),
        limit: String(CONTACT_PAGE_SIZE),
        ...(contactSearch ? { search: contactSearch } : {}),
      })
      let payload: AgingApiResponse
      try {
        payload = await fetchJson<AgingApiResponse>(`/api/v1/expenses/reports/aging?${params}`)
      } catch (e) {
        if (cancelled) return
        setContactsError(getApiErrorMessage(e))
        setContactRows([])
        setContactsTotal(0)
        return
      }
      if (cancelled) return

      const sourceRows = Array.isArray(payload?.data) ? payload.data : []
      const mappedRows: ContactRow[] = sourceRows.map(row => ({
        id: row.contact_id,
        legal_name: row.legal_name,
        trade_name: row.trade_name,
        balance: row.balance,
        overdue: new Decimal(row.balance).minus(row.current).toFixed(2),
      }))

      setContactsError(null)
      setContactRows(mappedRows)
      setContactsTotal(typeof payload?.total === 'number' ? payload.total : mappedRows.length)

      setSelectedContactId(prev => prev ?? mappedRows[0]?.id ?? null)
    }

    void loadContacts()
    return () => { cancelled = true }
  }, [contactsPage, contactSearch])

  useEffect(() => {
    if (!selectedContactId) {
      queueMicrotask(() => {
        setLineItems([])
        setLineTotal(0)
        setSelectedSummary(DEFAULT_SUMMARY)
        setSelectedContactName(null)
        setSelectedContactTradeName(null)
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
      let payload: StatementResponse
      try {
        payload = await fetchJson<StatementResponse>(
          `/api/v1/expenses/account-statements/${selectedContactId}?${params}`,
        )
      } catch (e) {
        if (cancelled) return
        setStatementError(getApiErrorMessage(e))
        return
      }
      if (cancelled) return

      const rows = Array.isArray(payload?.data) ? payload.data : []
      setStatementError(null)
      setLineItems(rows)
      setLineTotal(typeof payload?.total === 'number' ? payload.total : 0)
      setSelectedSummary(payload.summary ?? DEFAULT_SUMMARY)
      setSelectedContactName(payload.contact?.legal_name ?? null)
      setSelectedContactTradeName(payload.contact?.trade_name ?? null)
    }

    void loadStatement()
    return () => { cancelled = true }
  }, [selectedContactId, linePage, lineSearch, lineTypeFilter, fromDate, toDate])

  const contactColumns = useMemo<Column<ContactRow>[]>(() => ([
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
      <TopBar breadcrumbs={[{ label: 'Expensas', href: '/expensas' }, { label: 'Cuenta corriente' }]} />

      <PageBody>
        {contactsError && <p className="mb-3 text-sm text-danger">{contactsError}</p>}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(360px,420px)_1fr]">
          <div className="space-y-2">
            <DataTable
              columns={contactColumns}
              data={contactRows}
              keyExtractor={row => row.id}
              onRowClick={(row) => { selectContact(row.id) }}
              emptyMessage="No hay proveedores con saldo pendiente."
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
                  <span className="flex-1" />
                  <span className="text-[12px] text-fg-muted">{contactRows.length} proveedor{contactRows.length !== 1 ? 'es' : ''}</span>
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
            <p className="text-[12px] text-fg-muted">
              Se listan proveedores con saldo pendiente. Incluye solo gastos con proveedor asignado.
            </p>
            <div>
              <p className="mb-1 text-[12px] text-fg-muted">Ver cuenta corriente de otro proveedor</p>
              <SearchableSelect
                value={selectedContactId}
                onChange={selectContact}
                onSearch={searchSuppliers}
                placeholder="Buscar proveedor…"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded border border-border bg-surface p-4">
              <p className="text-[12px] uppercase tracking-wide text-fg-muted">Proveedor seleccionado</p>
              <h2 className="mt-1 text-[20px] font-semibold text-fg">{selectedContactName ?? 'Seleccioná un proveedor'}</h2>
              {selectedContactTradeName ? <p className="text-[13px] text-fg-muted">{selectedContactTradeName}</p> : null}
              <div className="mt-3 flex items-center gap-2">
                <StatusBadge value={DEBT_STATUS_LABEL[selectedSummary.debt_status]} />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryMetric label="Saldo" value={selectedSummary.balance} emphasis />
                <SummaryMetric label="Vencido" value={selectedSummary.overdue_balance} />
                <SummaryMetric label="Facturado" value={selectedSummary.total_invoiced} />
                <SummaryMetric label="Pagado" value={selectedSummary.total_paid} />
              </div>
            </div>

            {statementError && <p className="text-sm text-danger">{statementError}</p>}

            <DataTable
              columns={movementColumns}
              data={lineItems}
              keyExtractor={row => row.id}
              onRowClick={(row) => {
                const href = getMovementHref(row)
                if (href) router.push(href)
              }}
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
