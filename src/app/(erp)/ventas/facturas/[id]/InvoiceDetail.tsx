'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/primitives/Button'
import { SendDocumentEmail } from '@/components/erp/SendDocumentEmail'
import { Input } from '@/components/primitives/Input'
import { Textarea } from '@/components/primitives/Textarea'
import { FormField } from '@/components/primitives/FormField'
import { StatusBadge } from '@/components/primitives/Badge'
import { TotalsFooter } from '@/components/erp/TotalsFooter'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { EmptyState } from '@/components/erp/EmptyState'
import { DatePicker } from '@/components/primitives/DatePicker'
import { CurrencyInput, formatARS } from '@/components/primitives/CurrencyInput'
import { StatusPipeline } from '@/components/erp/StatusPipeline'
import { VentasSubNav } from '../../VentasSubNav'
import type { Invoice, Payment, PaymentMethod } from '../../types'
import { INVOICE_STATUS_LABEL, PAYMENT_CONDITION_LABEL, PAYMENT_METHOD_LABEL } from '../../types'
import { cn } from '@/lib/utils'
import { fetchJson, getApiErrorMessage, isApiRequestError } from '@/lib/fetch-json'
import { notifyApiError, notifySuccess } from '@/lib/notify'

const PAYMENT_METHOD_OPTIONS = (Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map(
  m => ({ value: m, label: PAYMENT_METHOD_LABEL[m] })
)

interface InvoiceDetailProps {
  id: string
}

type ContactLabel = { id: string; legal_name: string; trade_name: string | null }

export function InvoiceDetail({ id }: InvoiceDetailProps) {
  const router = useRouter()
  const [invoice, setInvoice]     = useState<Invoice | null>(null)
  const [contact, setContact]     = useState<ContactLabel | null>(null)
  const [loading, setLoading]     = useState(true)
  const [notFound, setNotFound]   = useState(false)
  const [refresh, setRefresh]     = useState(0)

  const [confirmIssue, setConfirmIssue]         = useState(false)
  const [confirmCancel, setConfirmCancel]       = useState(false)
  const [confirmDeleteInv, setConfirmDeleteInv] = useState(false)

  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transfer')
  const [paymentDate, setPaymentDate]     = useState<Date | null>(new Date())
  const [paymentRef, setPaymentRef]         = useState('')
  const [paymentNotes, setPaymentNotes]     = useState('')
  const [paymentError, setPaymentError]     = useState<string | null>(null)
  const [paymentSaving, setPaymentSaving]   = useState(false)

  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const data = await fetchJson<Invoice>(`/api/v1/sales/invoices/${id}`)
        if (cancelled) return
        let nextContact: ContactLabel | null = null
        if (data.contact_id && data.contact) {
          nextContact = {
            id: data.contact_id,
            legal_name: data.contact.legal_name,
            trade_name: data.contact.trade_name ?? null,
          }
        } else if (data.contact_id) {
          try {
            nextContact = await fetchJson<ContactLabel>(`/api/v1/contacts/${data.contact_id}`)
          } catch {
            nextContact = null
          }
        }
        if (cancelled) return
        setInvoice(data)
        setContact(nextContact)
        setNotFound(false)
        const bal = parseFloat(data.balance)
        if (!Number.isNaN(bal) && bal > 0) setPaymentAmount(data.balance)
        else setPaymentAmount('')
      } catch (e) {
        if (cancelled) return
        if (isApiRequestError(e) && e.status === 404) {
          setNotFound(true)
          setInvoice(null)
          setContact(null)
        } else {
          notifyApiError(e)
          setInvoice(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, refresh])

  const payments: Payment[] = invoice?.payments ?? []

  async function handleIssue() {
    setConfirmIssue(false)
    try {
      await fetchJson(`/api/v1/sales/invoices/${id}/issue`, { method: 'POST' })
      notifySuccess('Factura emitida')
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    }
  }

  async function handleCancelInvoice() {
    setConfirmCancel(false)
    try {
      await fetchJson(`/api/v1/sales/invoices/${id}/cancel`, { method: 'POST' })
      notifySuccess('Factura anulada')
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    }
  }

  async function handleDeleteInvoice() {
    setConfirmDeleteInv(false)
    try {
      await fetchJson(`/api/v1/sales/invoices/${id}`, { method: 'DELETE' })
      notifySuccess('Factura eliminada')
      router.push('/ventas/facturas')
    } catch (e) {
      notifyApiError(e)
    }
  }

  async function handleRegisterPayment(e: React.FormEvent) {
    e.preventDefault()
    setPaymentError(null)
    const amountNum = parseFloat(paymentAmount)
    if (!invoice || Number.isNaN(amountNum) || amountNum <= 0) {
      setPaymentError('Ingresá un importe válido.')
      return
    }
    const balance = parseFloat(invoice.balance)
    if (amountNum > balance + 0.005) {
      setPaymentError(`El importe no puede superar el saldo (${formatARS(invoice.balance)}).`)
      return
    }

    setPaymentSaving(true)
    const body: Record<string, unknown> = {
      invoice_id:       id,
      amount:           amountNum,
      payment_method:   paymentMethod,
      reference:        paymentRef.trim() || null,
      notes:            paymentNotes.trim() || null,
    }
    if (paymentDate) body.payment_date = paymentDate.toISOString()

    try {
      await fetchJson('/api/v1/sales/payments', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      setPaymentRef('')
      setPaymentNotes('')
      setPaymentDate(new Date())
      notifySuccess('Cobro registrado')
      setRefresh(r => r + 1)
    } catch (e) {
      setPaymentError(getApiErrorMessage(e))
    } finally {
      setPaymentSaving(false)
    }
  }

  async function handleDeletePayment() {
    if (!paymentToDelete) return
    try {
      await fetchJson(`/api/v1/sales/payments/${paymentToDelete.id}`, { method: 'DELETE' })
      setPaymentToDelete(null)
      notifySuccess('Cobro eliminado')
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Ventas', href: '/ventas/presupuestos' }, { label: 'Facturas', href: '/ventas/facturas' }, { label: '…' }]} />
        <VentasSubNav />
        <div className="flex-1 flex items-center justify-center text-[13px] text-fg-subtle">Cargando…</div>
      </div>
    )
  }

  if (notFound || !invoice) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Ventas', href: '/ventas/presupuestos' }, { label: 'Facturas', href: '/ventas/facturas' }, { label: 'No encontrado' }]} />
        <VentasSubNav />
        <div className="flex-1 flex items-center justify-center">
          <EmptyState title="Factura no encontrada" description="La factura no existe o fue eliminada." />
        </div>
      </div>
    )
  }

  const displayContact: ContactLabel | null =
    invoice.contact_id && invoice.contact
      ? {
          id: invoice.contact_id,
          legal_name: invoice.contact.legal_name,
          trade_name: invoice.contact.trade_name ?? null,
        }
      : contact

  const canIssue = invoice.status === 'draft'
  const canCancel =
    invoice.status !== 'paid' &&
    invoice.status !== 'cancelled' &&
    invoice.status !== 'draft'
  const canPay =
    (invoice.status === 'issued' || invoice.status === 'partially_paid') &&
    parseFloat(invoice.balance) > 0

  const balanceNum = parseFloat(invoice.balance)

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Ventas', href: '/ventas/presupuestos' },
          { label: 'Facturas', href: '/ventas/facturas' },
          { label: invoice.invoice_number },
        ]}
        actions={
          <div className="flex flex-wrap gap-2 justify-end">
            <Button asChild size="sm" variant="ghost">
              <Link href={`/ventas/facturas/${id}/print`} target="_blank" rel="noopener noreferrer">
                Imprimir
              </Link>
            </Button>
            <SendDocumentEmail
              documentType="invoice"
              documentId={id}
              documentLabel={`Factura ${invoice.invoice_number}`}
            />
            {canIssue && (
              <>
                <Button size="sm" variant="secondary" onClick={() => setConfirmIssue(true)}>
                  Emitir factura
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteInv(true)}>
                  Eliminar
                </Button>
              </>
            )}
            {canCancel && (
              <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(true)}>
                Anular
              </Button>
            )}
          </div>
        }
      />
      <VentasSubNav />

      <div className="flex-1 p-5 overflow-auto">
        <div className="max-w-3xl mx-auto flex flex-col gap-5">
          {/* Status pipeline */}
          <div className="bg-surface border border-border rounded-sm px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide mb-1">Factura</p>
              <h1 className="text-[20px] font-bold text-fg tracking-tight">{invoice.invoice_number}</h1>
            </div>
            <StatusPipeline type="invoice" status={invoice.status} />
          </div>

          <div className="bg-surface border border-border rounded-sm p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <StatusBadge value={INVOICE_STATUS_LABEL[invoice.status]} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px]">
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Sucursal</p>
                <p className="text-fg">
                  {invoice.branch
                    ? `${String(invoice.branch.branch_code).padStart(2, '0')} — ${invoice.branch.name}`
                    : <span className="text-fg-subtle">—</span>}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Cliente</p>
                {displayContact ? (
                  <>
                    <Link
                      href={`/contactos/${displayContact.id}`}
                      className="text-fg font-medium hover:text-blue-600 hover:underline"
                    >
                      {displayContact.legal_name}
                    </Link>
                    {displayContact.trade_name && (
                      <p className="text-[12px] text-fg-muted">{displayContact.trade_name}</p>
                    )}
                  </>
                ) : (
                  <p className="text-fg font-medium">{invoice.contact_id ? '—' : <span className="text-fg-subtle">—</span>}</p>
                )}
              </div>
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Condición de pago</p>
                <p className="text-fg">{PAYMENT_CONDITION_LABEL[invoice.payment_condition]}</p>
              </div>
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Saldo</p>
                <p
                  data-testid="invoice-balance"
                  className={cn('tabular-nums font-semibold', balanceNum > 0 ? 'text-danger' : 'text-success')}
                >
                  {formatARS(invoice.balance)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 pt-4 border-t border-border text-[13px]">
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Emisión</p>
                <p className="text-fg">
                  {invoice.issue_date
                    ? new Date(invoice.issue_date).toLocaleDateString('es-AR')
                    : <span className="text-fg-subtle">—</span>}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Vencimiento</p>
                <p className="text-fg">
                  {invoice.due_date
                    ? new Date(invoice.due_date).toLocaleDateString('es-AR')
                    : <span className="text-fg-subtle">—</span>}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Cobrado</p>
                <p className="text-fg tabular-nums">{formatARS(invoice.paid_amount)}</p>
              </div>
              {invoice.salesperson && (
                <div>
                  <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Vendedor</p>
                  <p className="text-fg">{invoice.salesperson.name}</p>
                </div>
              )}
            </div>

            {(invoice.quote_id || invoice.order_id) && (
              <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-2">
                <span className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide self-center mr-2">Origen</span>
                {invoice.quote_id && (
                  <Button variant="ghost" size="xs" asChild>
                    <Link href={`/ventas/presupuestos/${invoice.quote_id}`}>Ver presupuesto</Link>
                  </Button>
                )}
                {invoice.order_id && (
                  <Button variant="ghost" size="xs" asChild>
                    <Link href={`/ventas/pedidos/${invoice.order_id}`}>Ver pedido</Link>
                  </Button>
                )}
              </div>
            )}

            {(invoice.notes || invoice.internal_notes) && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
                {invoice.notes && (
                  <div>
                    <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Notas</p>
                    <p className="text-[13px] text-fg-muted whitespace-pre-line">{invoice.notes}</p>
                  </div>
                )}
                {invoice.internal_notes && (
                  <div>
                    <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Notas internas</p>
                    <p className="text-[13px] text-fg-muted whitespace-pre-line">{invoice.internal_notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-surface border border-border rounded-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h2 className="text-[13px] font-semibold text-fg">Ítems</h2>
            </div>
            {invoice.items && invoice.items.length > 0 ? (
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-surface-muted border-b border-border">
                    <th className="px-4 py-2 text-left font-medium text-fg-muted">Descripción</th>
                    <th className="px-4 py-2 text-right font-medium text-fg-muted">Cant.</th>
                    <th className="px-4 py-2 text-right font-medium text-fg-muted">P. unitario</th>
                    <th className="px-4 py-2 text-right font-medium text-fg-muted">Desc.</th>
                    <th className="px-4 py-2 text-right font-medium text-fg-muted">IVA</th>
                    <th className="px-4 py-2 text-right font-medium text-fg-muted">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map(item => (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 text-fg">{item.description}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">{item.quantity}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">{formatARS(item.unit_price)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">
                        {parseFloat(item.discount_pct) > 0 ? `${item.discount_pct}%` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">{item.iva_rate}%</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium text-fg">{formatARS(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-4 py-8 text-center text-[13px] text-fg-subtle">Sin ítems</div>
            )}
          </div>

          <TotalsFooter
            subtotal={invoice.subtotal}
            discountAmount={invoice.discount_amount}
            taxAmount={invoice.tax_amount}
            total={invoice.total}
            className="max-w-xs self-end"
          />

          {canPay && (
            <div className="bg-surface border border-border rounded-sm p-5" data-testid="payment-form">
              <h2 className="text-[13px] font-semibold text-fg mb-4">Registrar cobro</h2>
              <form onSubmit={handleRegisterPayment} className="flex flex-col gap-4 max-w-lg">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Importe" htmlFor="pay_amount">
                    <CurrencyInput
                      id="pay_amount"
                      data-testid="payment-amount-input"
                      value={paymentAmount}
                      onChange={setPaymentAmount}
                      error={!!paymentError}
                    />
                  </FormField>
                  <FormField label="Fecha del cobro" htmlFor="pay_date">
                    <DatePicker id="pay_date" value={paymentDate} onChange={setPaymentDate} placeholder="Seleccionar fecha" />
                  </FormField>
                </div>
                <FormField label="Medio de pago" htmlFor="pay_method">
                  <select
                    id="pay_method"
                    data-testid="payment-method-select"
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="flex h-8 w-full max-w-xs rounded-sm border border-border-strong bg-surface px-2.5 text-[13px] text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring"
                  >
                    {PAYMENT_METHOD_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Referencia (opcional)" htmlFor="pay_ref">
                  <Input id="pay_ref" value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="N° transferencia, cheque…" />
                </FormField>
                <FormField label="Notas (opcional)" htmlFor="pay_notes">
                  <Textarea id="pay_notes" value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} rows={2} />
                </FormField>
                {paymentError && (
                  <p role="alert" className="text-[12px] text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">
                    {paymentError}
                  </p>
                )}
                <div>
                  <Button type="submit" size="sm" disabled={paymentSaving} data-testid="payment-submit-btn">
                    {paymentSaving ? 'Registrando…' : 'Registrar cobro'}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {payments.length > 0 && (
            <div className="bg-surface border border-border rounded-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <h2 className="text-[13px] font-semibold text-fg">Cobros registrados</h2>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-surface-muted border-b border-border">
                    <th className="px-4 py-2 text-left font-medium text-fg-muted">N°</th>
                    <th className="px-4 py-2 text-left font-medium text-fg-muted">Fecha</th>
                    <th className="px-4 py-2 text-right font-medium text-fg-muted">Importe</th>
                    <th className="px-4 py-2 text-left font-medium text-fg-muted">Medio</th>
                    <th className="px-4 py-2 text-left font-medium text-fg-muted">Referencia</th>
                    <th className="px-4 py-2 text-right font-medium text-fg-muted w-20" />
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 font-mono text-fg-muted">{p.payment_number}</td>
                      <td className="px-4 py-2.5 text-fg-muted">
                        {new Date(p.payment_date).toLocaleDateString('es-AR')}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatARS(p.amount)}</td>
                      <td className="px-4 py-2.5 text-fg-muted">{PAYMENT_METHOD_LABEL[p.payment_method]}</td>
                      <td className="px-4 py-2.5 text-fg-muted">{p.reference ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right">
                        {invoice.status !== 'cancelled' && (
                          <Button type="button" variant="ghost" size="xs" onClick={() => setPaymentToDelete(p)}>
                            Quitar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmIssue}
        onOpenChange={setConfirmIssue}
        title="Emitir factura"
        description={`La factura ${invoice.invoice_number} pasará a estado emitida y podrás registrar cobros.`}
        confirmLabel="Emitir"
        variant="warning"
        onConfirm={handleIssue}
      />

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Anular factura"
        description={`Se anulará ${invoice.invoice_number}. No podrás registrar cobros sobre esta factura.`}
        confirmLabel="Anular"
        variant="warning"
        onConfirm={handleCancelInvoice}
      />

      <ConfirmDialog
        open={confirmDeleteInv}
        onOpenChange={setConfirmDeleteInv}
        title="Eliminar factura"
        description={`¿Eliminar ${invoice.invoice_number}? Solo se pueden eliminar borradores.`}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDeleteInvoice}
      />

      <ConfirmDialog
        open={!!paymentToDelete}
        onOpenChange={open => { if (!open) setPaymentToDelete(null) }}
        title="Quitar cobro"
        description={
          paymentToDelete
            ? `Se eliminará el cobro ${paymentToDelete.payment_number} y se recalculará el saldo de la factura.`
            : ''
        }
        confirmLabel="Quitar"
        variant="danger"
        onConfirm={handleDeletePayment}
      />
    </div>
  )
}
