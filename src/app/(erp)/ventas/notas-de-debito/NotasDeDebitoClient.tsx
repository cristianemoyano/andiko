'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Decimal from 'decimal.js'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { StatusBadge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { Dialog } from '@/components/primitives/Dialog'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { SearchableSelect, type SearchableSelectOption } from '@/components/erp/SearchableSelect'
import { BranchSelectField } from '@/components/erp/BranchSelectField'
import { VentasSubNav } from '../VentasSubNav'
import { fetchJson } from '@/lib/fetch-json'

type DebitNoteStatus = 'draft' | 'issued' | 'cancelled'
type DebitNoteRow = {
  id: string
  debit_note_number: string
  status: DebitNoteStatus
  issue_date: string | null
  total: string
  reason: string | null
  contact: { id: string; legal_name: string; trade_name: string | null } | null
  invoice: { id: string; invoice_number: string } | null
}

type InvoiceOption = {
  id: string
  invoice_number: string
  total: string
  balance: string
  status: string
}

const STATUS_LABEL: Record<DebitNoteStatus, string> = {
  draft:     'Borrador',
  issued:    'Emitida',
  cancelled: 'Anulada',
}

const IVA_RATES = [
  { label: 'Sin IVA (0%)', value: '0' },
  { label: 'IVA 10.5%',   value: '0.105' },
  { label: 'IVA 21%',     value: '0.21' },
  { label: 'IVA 27%',     value: '0.27' },
]

const PAGE_SIZE = 20

const COLUMNS: Column<DebitNoteRow>[] = [
  {
    key: 'debit_note_number',
    header: 'Número',
    render: row => <span className="font-mono text-[12px] text-fg-muted">{row.debit_note_number}</span>,
  },
  {
    key: 'status',
    header: 'Estado',
    render: row => <StatusBadge value={STATUS_LABEL[row.status]} />,
  },
  {
    key: 'contact',
    header: 'Cliente',
    render: row => row.contact
      ? (
        <div className="min-w-0">
          <p className="truncate font-medium text-fg">{row.contact.legal_name}</p>
          {row.contact.trade_name ? <p className="text-[12px] text-fg-muted truncate">{row.contact.trade_name}</p> : null}
        </div>
      )
      : <span className="text-fg-subtle">—</span>,
  },
  {
    key: 'invoice',
    header: 'Factura orig.',
    render: row => row.invoice
      ? <span className="font-mono text-[12px] text-fg-muted">{row.invoice.invoice_number}</span>
      : <span className="text-fg-subtle">—</span>,
  },
  {
    key: 'issue_date',
    header: 'Fecha',
    render: row => row.issue_date ? new Date(row.issue_date).toLocaleDateString('es-AR') : '—',
  },
  {
    key: 'total',
    header: 'Total',
    align: 'right',
    render: row => <span className="tabular-nums font-medium">{formatARS(row.total)}</span>,
  },
  {
    key: 'reason',
    header: 'Motivo',
    render: row => <span className="text-[12px] text-fg-muted truncate max-w-[200px] block">{row.reason ?? '—'}</span>,
  },
]

export function NotasDeDebitoClient() {
  const [rows, setRows] = useState<DebitNoteRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [refresh, setRefresh] = useState(0)

  const [modalOpen, setModalOpen] = useState(false)

  const [branchId, setBranchId] = useState('')
  const [contactId, setContactId] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [invoiceOptions, setInvoiceOptions] = useState<InvoiceOption[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [netAmount, setNetAmount] = useState('')
  const [ivaRate, setIvaRate] = useState('0.21')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formKey, setFormKey] = useState(0)

  const router = useRouter()

  const netDec = new Decimal(netAmount || '0')
  const taxDec = netDec.mul(new Decimal(ivaRate))
  const totalDec = netDec.plus(taxDec)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        ...(search ? { search } : {}),
      })
      try {
        const payload = await fetchJson<{ data: DebitNoteRow[]; total: number }>(`/api/v1/sales/debit-notes?${params}`)
        if (cancelled) return
        setRows(Array.isArray(payload?.data) ? payload.data : [])
        setTotal(typeof payload?.total === 'number' ? payload.total : 0)
      } catch {
        if (!cancelled) { setRows([]); setTotal(0) }
      }
    }
    void load()
    return () => { cancelled = true }
  }, [page, search, refresh])

  useEffect(() => {
    queueMicrotask(() => { setInvoiceId(''); setInvoiceOptions([]) })
    if (!contactId) return

    let cancelled = false
    queueMicrotask(() => setLoadingInvoices(true))
    fetchJson<{ data: InvoiceOption[] }>(
      `/api/v1/sales/invoices?contact_id=${contactId}&status=issued&limit=50&page=1`,
    )
      .then(payload => {
        if (cancelled) return
        setInvoiceOptions((payload?.data ?? []).filter(i => ['issued', 'partially_paid'].includes(i.status)))
      })
      .catch(() => { if (!cancelled) setInvoiceOptions([]) })
      .finally(() => { if (!cancelled) setLoadingInvoices(false) })

    return () => { cancelled = true }
  }, [contactId])

  const searchCustomers = useCallback(async (q: string): Promise<SearchableSelectOption[]> => {
    try {
      const data = await fetchJson<{ data: Array<{ id: string; legal_name: string; trade_name: string | null }> }>(
        `/api/v1/contacts?search=${encodeURIComponent(q)}&limit=20&type=customer`,
      )
      return (data.data ?? []).map(c => ({ value: c.id, label: c.legal_name, sublabel: c.trade_name ?? undefined }))
    } catch {
      return []
    }
  }, [])

  function openCreate() {
    setBranchId('')
    setContactId('')
    setInvoiceId('')
    setInvoiceOptions([])
    setNetAmount('')
    setIvaRate('0.21')
    setReason('')
    setNotes('')
    setIssueDate(new Date().toISOString().slice(0, 10))
    setErrors({})
    setServerError('')
    setFormKey(k => k + 1)
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const newErrors: Record<string, string> = {}
    if (!branchId) newErrors.branch = 'Seleccioná una sucursal'
    if (!contactId) newErrors.contact = 'Seleccioná un cliente'
    if (!netAmount || netDec.lte(0)) newErrors.netAmount = 'Ingresá un importe neto válido'
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return }

    setSubmitting(true)
    setServerError('')
    try {
      await fetchJson('/api/v1/sales/debit-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: branchId,
          contact_id: contactId,
          invoice_id: invoiceId || undefined,
          issue_date: issueDate || undefined,
          subtotal: netDec.toFixed(2),
          tax_amount: taxDec.toFixed(2),
          total: totalDec.toFixed(2),
          reason: reason.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      })
      setModalOpen(false)
      setRefresh(r => r + 1)
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Error al crear la nota de débito')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedInvoice = invoiceOptions.find(i => i.id === invoiceId)

  return (
    <div className="flex h-full flex-col">
      <TopBar
        breadcrumbs={[{ label: 'Ventas', href: '/ventas/presupuestos' }, { label: 'Notas de débito' }]}
        actions={<Button size="sm" onClick={openCreate}>Nueva nota de débito</Button>}
      />
      <VentasSubNav />

      <PageBody>
        <DataTable
          columns={COLUMNS}
          data={rows}
          keyExtractor={row => row.id}
          emptyMessage="No hay notas de débito."
          onRowClick={row => router.push(`/ventas/notas-de-debito/${row.id}`)}
          toolbar={
            <>
              <div className="relative flex items-center w-full sm:w-auto">
                <svg className="pointer-events-none absolute left-2 text-fg-subtle" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="7" cy="7" r="4.5" />
                  <path d="M10.5 10.5l3 3" />
                </svg>
                <input
                  className="h-[30px] w-full sm:w-52 rounded-sm border border-border-strong bg-surface pl-7 pr-3 text-[13px] focus:border-ring focus:outline-none"
                  placeholder="Buscar número, cliente o factura..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                />
              </div>
              <span className="flex-1" />
              <span className="text-[12px] text-fg-muted">{total} nota{total !== 1 ? 's' : ''}</span>
            </>
          }
          footer={
            total > 0 ? (
              <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            ) : undefined
          }
        />
      </PageBody>

      <Dialog open={modalOpen} onOpenChange={setModalOpen} title="Nueva nota de débito">
        <form key={formKey} onSubmit={handleSubmit} className="space-y-4 p-5 min-w-[440px]">

          <FormField label="Sucursal *" error={errors.branch}>
            <BranchSelectField value={branchId} onChange={v => { setBranchId(v ?? ''); setErrors(e => ({ ...e, branch: '' })) }} />
          </FormField>

          <FormField label="Cliente *" error={errors.contact}>
            <SearchableSelect
              value={contactId}
              onChange={v => { setContactId(v ?? ''); setErrors(e => ({ ...e, contact: '' })) }}
              onSearch={searchCustomers}
              placeholder="Buscar cliente…"
            />
          </FormField>

          <FormField label="Factura original (opcional)">
            {loadingInvoices ? (
              <p className="text-[12px] text-fg-subtle py-1">Cargando facturas…</p>
            ) : !contactId ? (
              <p className="text-[12px] text-fg-subtle py-1">Seleccioná un cliente primero</p>
            ) : invoiceOptions.length === 0 ? (
              <p className="text-[12px] text-fg-subtle py-1">No hay facturas con saldo para este cliente</p>
            ) : (
              <select
                className="h-9 w-full rounded-md border border-border bg-surface px-3 text-[13px] text-fg focus:outline-none focus:ring-2 focus:ring-ring"
                value={invoiceId}
                onChange={e => setInvoiceId(e.target.value)}
              >
                <option value="">— Sin factura vinculada —</option>
                {invoiceOptions.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number} — Saldo: {formatARS(inv.balance)}
                  </option>
                ))}
              </select>
            )}
            {selectedInvoice && (
              <p className="mt-1 text-[11px] text-fg-muted">
                Total factura: {formatARS(selectedInvoice.total)} · Saldo pendiente: {formatARS(selectedInvoice.balance)}
              </p>
            )}
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Importe neto *" error={errors.netAmount}>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={netAmount}
                onChange={e => { setNetAmount(e.target.value); setErrors(er => ({ ...er, netAmount: '' })) }}
                placeholder="0.00"
              />
            </FormField>

            <FormField label="Alícuota IVA">
              <select
                className="h-9 w-full rounded-md border border-border bg-surface px-3 text-[13px] text-fg focus:outline-none focus:ring-2 focus:ring-ring"
                value={ivaRate}
                onChange={e => setIvaRate(e.target.value)}
              >
                {IVA_RATES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </FormField>
          </div>

          {netDec.gt(0) && (
            <div className="rounded-sm border border-border bg-surface-muted px-3 py-2 text-[12px] text-fg-muted flex flex-col gap-0.5">
              <div className="flex justify-between">
                <span>Subtotal neto</span>
                <span className="tabular-nums">{formatARS(netDec.toFixed(2))}</span>
              </div>
              <div className="flex justify-between">
                <span>IVA ({(Number(ivaRate) * 100).toFixed(1)}%)</span>
                <span className="tabular-nums">{formatARS(taxDec.toFixed(2))}</span>
              </div>
              <div className="flex justify-between font-semibold text-fg border-t border-border mt-1 pt-1">
                <span>Total nota de débito</span>
                <span className="tabular-nums">{formatARS(totalDec.toFixed(2))}</span>
              </div>
            </div>
          )}

          <FormField label="Fecha de emisión">
            <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
          </FormField>

          <FormField label="Motivo *">
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Ej: Intereses, diferencia de precio…" />
          </FormField>

          <FormField label="Notas internas">
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional" />
          </FormField>

          {serverError && <p className="text-[13px] text-danger">{serverError}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Guardando...' : 'Crear borrador'}</Button>
          </div>
        </form>
      </Dialog>

    </div>
  )
}
