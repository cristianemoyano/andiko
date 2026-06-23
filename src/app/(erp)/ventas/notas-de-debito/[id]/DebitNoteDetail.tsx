'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Decimal from 'decimal.js'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { FormField } from '@/components/primitives/FormField'
import { StatusBadge } from '@/components/primitives/Badge'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { SearchableSelect, type SearchableSelectOption } from '@/components/erp/SearchableSelect'
import { BranchSelectField } from '@/components/erp/BranchSelectField'
import { AfipDocumentPanel } from '@/components/erp/AfipDocumentPanel'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { VentasSubNav } from '../../VentasSubNav'
import type { AfipDocumentFields, BranchSummary } from '../../types'
import { fetchJson } from '@/lib/fetch-json'
import { notifyApiError, notifyInfo, notifySuccess } from '@/lib/notify'

type DebitNoteStatus = 'draft' | 'issued' | 'cancelled'
type DebitNote = AfipDocumentFields & {
  id: string
  debit_note_number: string
  status: DebitNoteStatus
  issue_date: string | null
  currency: string
  subtotal: string
  discount_amount: string
  tax_amount: string
  total: string
  reason: string | null
  notes: string | null
  branch_id: string | null
  contact_id: string | null
  invoice_id: string | null
  contact: { id: string; legal_name: string; trade_name: string | null } | null
  invoice: { id: string; invoice_number: string } | null
  branch?: BranchSummary | null
  created_at: string
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

type InvoiceOption = {
  id: string
  invoice_number: string
  total: string
  balance: string
  status: string
}

function deriveIvaRate(subtotal: string, taxAmount: string): string {
  const net = new Decimal(subtotal || '0')
  const tax = new Decimal(taxAmount || '0')
  if (net.eq(0)) return '0.21'
  const rounded = tax.div(net).toDecimalPlaces(3).toString()
  const match = IVA_RATES.find(r => new Decimal(r.value).toDecimalPlaces(3).toString() === rounded)
  return match?.value ?? '0.21'
}

export function DebitNoteDetail() {
  const { id } = useParams<{ id: string }>()

  const [note, setNote] = useState<DebitNote | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [refresh, setRefresh] = useState(0)

  const [editing, setEditing] = useState(false)
  const [branchId, setBranchId] = useState('')
  const [contactId, setContactId] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [invoiceOptions, setInvoiceOptions] = useState<InvoiceOption[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [netAmount, setNetAmount] = useState('')
  const [ivaRate, setIvaRate] = useState('0.21')
  const [reason, setReason] = useState('')
  const [noteText, setNoteText] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [issueConfirmOpen, setIssueConfirmOpen] = useState(false)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => setLoading(true))
    fetchJson<DebitNote>(`/api/v1/sales/debit-notes/${id}`)
      .then(data => {
        if (cancelled) return
        setNote(data)
        setNotFound(false)
      })
      .catch(() => { if (!cancelled) setNotFound(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id, refresh])

  useEffect(() => {
    if (!editing || !contactId) { queueMicrotask(() => setInvoiceOptions([])); return }
    let cancelled = false
    queueMicrotask(() => setLoadingInvoices(true))
    fetchJson<{ data: InvoiceOption[] }>(`/api/v1/sales/invoices?contact_id=${contactId}&limit=50&page=1`)
      .then(payload => {
        if (cancelled) return
        setInvoiceOptions((payload?.data ?? []).filter(i => ['issued', 'partially_paid'].includes(i.status)))
      })
      .catch(() => { if (!cancelled) setInvoiceOptions([]) })
      .finally(() => { if (!cancelled) setLoadingInvoices(false) })
    return () => { cancelled = true }
  }, [editing, contactId])

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

  function startEditing() {
    if (!note) return
    setBranchId(note.branch_id ?? '')
    setContactId(note.contact_id ?? '')
    setInvoiceId(note.invoice_id ?? '')
    setNetAmount(note.subtotal)
    setIvaRate(deriveIvaRate(note.subtotal, note.tax_amount))
    setReason(note.reason ?? '')
    setNoteText(note.notes ?? '')
    setIssueDate(note.issue_date ? note.issue_date.slice(0, 10) : new Date().toISOString().slice(0, 10))
    setSaveError('')
    setEditing(true)
  }

  async function handleSave() {
    if (!note) return
    const net = new Decimal(netAmount || '0')
    const tax = net.mul(new Decimal(ivaRate))
    const total = net.plus(tax)

    setSaving(true)
    setSaveError('')
    try {
      await fetchJson(`/api/v1/sales/debit-notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: branchId || undefined,
          contact_id: contactId || undefined,
          invoice_id: invoiceId || undefined,
          issue_date: issueDate || undefined,
          subtotal: net.toFixed(2),
          tax_amount: tax.toFixed(2),
          total: total.toFixed(2),
          reason: reason.trim() || undefined,
          notes: noteText.trim() || undefined,
        }),
      })
      setEditing(false)
      setRefresh(r => r + 1)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleIssue() {
    try {
      await fetchJson(`/api/v1/sales/debit-notes/${id}/issue`, { method: 'POST' })
      setIssueConfirmOpen(false)
      setRefresh(r => r + 1)
    } catch {
      setIssueConfirmOpen(false)
    }
  }

  async function handleCancel() {
    try {
      await fetchJson(`/api/v1/sales/debit-notes/${id}/cancel`, { method: 'POST' })
      setCancelConfirmOpen(false)
      setRefresh(r => r + 1)
    } catch {
      setCancelConfirmOpen(false)
    }
  }

  async function handleAuthorizeAfip() {
    try {
      const updated = await fetchJson<DebitNote>(`/api/v1/sales/debit-notes/${id}/afip-cae`, { method: 'POST' })
      if (updated.afip_status === 'authorized') notifySuccess('CAE autorizado por AFIP')
      else if (updated.afip_status === 'contingency') notifyInfo('Sin conexión con AFIP. Quedó en cola de contingencia.')
      else notifyInfo('AFIP rechazó el comprobante. Revisá las observaciones.')
    } catch (e) {
      notifyApiError(e)
    } finally {
      setRefresh(r => r + 1)
    }
  }

  const netDec = new Decimal(netAmount || '0')
  const taxDec = netDec.mul(new Decimal(ivaRate))
  const totalDec = netDec.plus(taxDec)

  if (loading) return <div className="flex h-full flex-col"><TopBar breadcrumbs={[{ label: 'Notas de débito', href: '/ventas/notas-de-debito' }, { label: '…' }]} /><VentasSubNav /></div>
  if (notFound || !note) return (
    <div className="flex h-full flex-col">
      <TopBar breadcrumbs={[{ label: 'Notas de débito', href: '/ventas/notas-de-debito' }, { label: 'No encontrada' }]} />
      <VentasSubNav />
      <div className="p-10 text-center text-fg-muted">Nota de débito no encontrada.</div>
    </div>
  )

  const isDraft = note.status === 'draft'
  const selectedInvoice = invoiceOptions.find(i => i.id === invoiceId)

  return (
    <div className="flex h-full flex-col">
      <TopBar
        breadcrumbs={[
          { label: 'Notas de débito', href: '/ventas/notas-de-debito' },
          { label: note.debit_note_number },
        ]}
        actions={
          <div className="flex gap-2">
            {!editing && (
              <Button asChild size="sm" variant="ghost">
                <Link href={`/ventas/notas-de-debito/${id}/print`} target="_blank" rel="noopener noreferrer">
                  Imprimir
                </Link>
              </Button>
            )}
            {isDraft && !editing && <Button size="sm" variant="secondary" onClick={startEditing}>Editar</Button>}
            {editing && <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>Cancelar edición</Button>}
            {editing && <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>}
            {isDraft && !editing && <Button size="sm" variant="secondary" onClick={() => setIssueConfirmOpen(true)}>Emitir</Button>}
            {note.status !== 'cancelled' && !editing && (
              <Button size="sm" variant="danger" onClick={() => setCancelConfirmOpen(true)}>Anular</Button>
            )}
          </div>
        }
      />
      <VentasSubNav />

      <PageBody>
        <div className="mx-auto max-w-2xl space-y-5">

          <div className="rounded border border-border bg-surface p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[12px] uppercase tracking-wide text-fg-subtle">Nota de débito</p>
                <h1 className="mt-0.5 text-[22px] font-semibold text-fg">{note.debit_note_number}</h1>
              </div>
              <StatusBadge value={STATUS_LABEL[note.status]} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Metric label="Total" value={formatARS(note.total)} emphasis />
              <Metric label="IVA" value={formatARS(note.tax_amount)} />
              <Metric label="Fecha" value={note.issue_date ? new Date(note.issue_date).toLocaleDateString('es-AR') : '—'} />
            </div>

            {note.contact && (
              <div className="mt-3 border-t border-border pt-3 text-[13px] text-fg-muted">
                <span className="text-fg-subtle">Cliente: </span>
                {note.contact.legal_name}
                {note.contact.trade_name ? <span className="text-fg-subtle"> · {note.contact.trade_name}</span> : null}
              </div>
            )}
            {note.invoice && (
              <div className="text-[13px] text-fg-muted">
                <span className="text-fg-subtle">Factura original: </span>
                <span className="font-mono">{note.invoice.invoice_number}</span>
              </div>
            )}
            {note.reason && (
              <div className="mt-2 text-[13px] text-fg-muted">
                <span className="text-fg-subtle">Motivo: </span>{note.reason}
              </div>
            )}
          </div>

          {editing && (
            <div className="rounded border border-blue-200 bg-blue-50/30 p-5 space-y-4">
              <p className="text-[13px] font-medium text-fg-muted">Editar borrador</p>

              <FormField label="Sucursal">
                <BranchSelectField value={branchId} onChange={v => setBranchId(v ?? '')} />
              </FormField>

              <FormField label="Cliente">
                <SearchableSelect value={contactId} onChange={v => setContactId(v ?? '')} onSearch={searchCustomers} placeholder="Buscar cliente…" />
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
                      <option key={inv.id} value={inv.id}>{inv.invoice_number} — Saldo: {formatARS(inv.balance)}</option>
                    ))}
                  </select>
                )}
                {selectedInvoice && (
                  <p className="mt-1 text-[11px] text-fg-muted">
                    Total: {formatARS(selectedInvoice.total)} · Saldo: {formatARS(selectedInvoice.balance)}
                  </p>
                )}
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Importe neto *">
                  <Input type="number" min="0" step="0.01" value={netAmount} onChange={e => setNetAmount(e.target.value)} placeholder="0.00" />
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
                <div className="rounded-sm border border-border bg-surface px-3 py-2 text-[12px] text-fg-muted flex flex-col gap-0.5">
                  <div className="flex justify-between"><span>Subtotal neto</span><span className="tabular-nums">{formatARS(netDec.toFixed(2))}</span></div>
                  <div className="flex justify-between"><span>IVA ({(Number(ivaRate) * 100).toFixed(1)}%)</span><span className="tabular-nums">{formatARS(taxDec.toFixed(2))}</span></div>
                  <div className="flex justify-between font-semibold text-fg border-t border-border mt-1 pt-1"><span>Total nota de débito</span><span className="tabular-nums">{formatARS(totalDec.toFixed(2))}</span></div>
                </div>
              )}

              <FormField label="Fecha de emisión">
                <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
              </FormField>

              <FormField label="Motivo">
                <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Ej: Intereses por mora" />
              </FormField>

              <FormField label="Notas internas">
                <Input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Opcional" />
              </FormField>

              {saveError && <p className="text-[13px] text-danger">{saveError}</p>}
            </div>
          )}

          {!editing && note.status !== 'draft' && (
            <AfipDocumentPanel
              doc={note}
              branch={note.branch ?? null}
              canAuthorize={note.status === 'issued' && note.afip_status !== 'authorized'}
              onAuthorize={handleAuthorizeAfip}
            />
          )}

          {!editing && (
            <div className="rounded border border-border bg-surface p-5">
              <p className="text-[12px] font-medium uppercase tracking-wide text-fg-subtle mb-3">Detalle de importes</p>
              <div className="space-y-1 text-[13px]">
                <div className="flex justify-between text-fg-muted"><span>Subtotal neto</span><span className="tabular-nums">{formatARS(note.subtotal)}</span></div>
                <div className="flex justify-between text-fg-muted"><span>IVA</span><span className="tabular-nums">{formatARS(note.tax_amount)}</span></div>
                <div className="flex justify-between font-semibold text-fg border-t border-border pt-2 mt-2"><span>Total</span><span className="tabular-nums">{formatARS(note.total)}</span></div>
              </div>
              {note.notes && <p className="mt-3 text-[12px] text-fg-muted border-t border-border pt-3">{note.notes}</p>}
            </div>
          )}
        </div>
      </PageBody>

      <ConfirmDialog
        open={issueConfirmOpen}
        onOpenChange={setIssueConfirmOpen}
        title="Emitir nota de débito"
        description={`¿Emitir ${note.debit_note_number}?`}
        confirmLabel="Emitir"
        variant="warning"
        onConfirm={handleIssue}
      />
      <ConfirmDialog
        open={cancelConfirmOpen}
        onOpenChange={setCancelConfirmOpen}
        title="Anular nota de débito"
        description={`¿Anular ${note.debit_note_number}?`}
        confirmLabel="Anular"
        variant="danger"
        onConfirm={handleCancel}
      />
    </div>
  )
}

function Metric({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="rounded border border-border bg-surface-muted p-3">
      <p className="text-[11px] text-fg-subtle">{label}</p>
      <p className={`tabular-nums text-[15px] font-semibold ${emphasis ? 'text-fg' : 'text-fg-muted'}`}>{value}</p>
    </div>
  )
}
