'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/primitives/Button'
import { StatusBadge } from '@/components/primitives/Badge'
import { TotalsFooter } from '@/components/erp/TotalsFooter'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { EmptyState } from '@/components/erp/EmptyState'
import { DatePicker } from '@/components/primitives/DatePicker'
import { CurrencyInput, formatARS } from '@/components/primitives/CurrencyInput'
import { FormField } from '@/components/primitives/FormField'
import { ComprasSubNav } from '../../ComprasSubNav'
import type { SupplierInvoice, SupplierPayment, PaymentMethod } from '../../types'
import { PURCHASE_ORDER_STATUS_LABEL, PURCHASE_RECEIPT_STATUS_LABEL, SUPPLIER_INVOICE_STATUS_LABEL, PAYMENT_CONDITION_LABEL, PAYMENT_METHOD_LABEL } from '../../types'

interface FacturaProvDetailProps {
  id: string
}

const PAYMENT_METHODS = (Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map(
  m => ({ value: m, label: PAYMENT_METHOD_LABEL[m] })
)

export function FacturaProvDetail({ id }: FacturaProvDetailProps) {
  const router = useRouter()
  const [invoice, setInvoice]   = useState<SupplierInvoice | null>(null)
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [refresh, setRefresh]   = useState(0)

  const [confirmReceive, setConfirmReceive] = useState(false)
  const [confirmCancel,  setConfirmCancel]  = useState(false)
  const [confirmDelete,  setConfirmDelete]  = useState(false)
  const [actionError,    setActionError]    = useState<string | null>(null)

  const [paymentAmount, setPaymentAmount]   = useState('')
  const [paymentDate,   setPaymentDate]     = useState<Date | null>(new Date())
  const [paymentMethod, setPaymentMethod]   = useState<PaymentMethod>('transfer')
  const [paymentNotes,  setPaymentNotes]    = useState('')
  const [paymentError,  setPaymentError]    = useState<string | null>(null)
  const [paymentSaving, setPaymentSaving]   = useState(false)
  const [paymentToDelete, setPaymentToDelete] = useState<SupplierPayment | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const r = await fetch(`/api/v1/purchases/supplier-invoices/${id}`)
        if (!mounted) return
        if (r.status === 404) { setNotFound(true); return }
        const inv = await r.json() as SupplierInvoice
        if (!mounted) return
        setInvoice(inv)
        setNotFound(false)
        const bal = parseFloat(inv.balance)
        setPaymentAmount(!Number.isNaN(bal) && bal > 0 ? inv.balance : '')
      } catch {
        // network error — leave current state
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [id, refresh])

  async function doAction(endpoint: string, method = 'POST') {
    setActionError(null)
    const res = await fetch(`/api/v1/purchases/supplier-invoices/${id}${endpoint}`, { method })
    if (!res.ok) {
      try {
        const d = await res.json() as { error?: string }
        setActionError(d.error ?? 'Ocurrió un error')
      } catch {
        setActionError('Ocurrió un error inesperado')
      }
      return false
    }
    setRefresh(r => r + 1)
    return true
  }

  async function handleDelete() {
    const ok = await doAction('', 'DELETE')
    if (ok) router.push('/compras/facturas')
  }

  async function handleAddPayment() {
    if (!invoice) return
    const amount = parseFloat(paymentAmount)
    if (!amount || amount <= 0) { setPaymentError('Ingresá un monto válido'); return }

    setPaymentSaving(true)
    setPaymentError(null)
    try {
      const res = await fetch('/api/v1/purchases/supplier-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id:    invoice.id,
          branch_id:     invoice.branch_id,
          contact_id:    invoice.contact_id,
          payment_date:  paymentDate ? paymentDate.toISOString() : new Date().toISOString(),
          amount,
          payment_method: paymentMethod,
          notes:         paymentNotes.trim() || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setPaymentError(d.error ?? 'Error al registrar el pago')
        return
      }
      setPaymentNotes('')
      setRefresh(r => r + 1)
    } finally {
      setPaymentSaving(false)
    }
  }

  async function handleDeletePayment(payment: SupplierPayment) {
    const res = await fetch(`/api/v1/purchases/supplier-payments/${payment.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json()
      setActionError(d.error ?? 'Error al eliminar el pago')
      return
    }
    setPaymentToDelete(null)
    setRefresh(r => r + 1)
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Facturas proveedor', href: '/compras/facturas' }, { label: '…' }]} />
        <ComprasSubNav />
        <div className="flex-1 flex items-center justify-center">
          <span className="text-zinc-400 text-sm">Cargando…</span>
        </div>
      </div>
    )
  }

  if (notFound || !invoice) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Facturas proveedor', href: '/compras/facturas' }, { label: 'No encontrada' }]} />
        <ComprasSubNav />
        <EmptyState title="Factura no encontrada" description="La factura de proveedor no existe o fue eliminada." />
      </div>
    )
  }

  const isDraft     = invoice.status === 'draft'
  const isReceived  = invoice.status === 'received' || invoice.status === 'partially_paid'
  const isPaid      = invoice.status === 'paid'
  const isCancelled = invoice.status === 'cancelled'
  const canPay      = isReceived && !isPaid && !isCancelled

  const subtotal = (invoice.items ?? []).reduce((acc, i) => acc + parseFloat(i.subtotal), 0)
  const taxAmt   = (invoice.items ?? []).reduce((acc, i) => acc + parseFloat(i.tax_amount), 0)
  const totalAmt = (invoice.items ?? []).reduce((acc, i) => acc + parseFloat(i.total), 0)

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Facturas proveedor', href: '/compras/facturas' },
          { label: invoice.invoice_number },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link href={`/compras/facturas/${id}/print`} target="_blank" rel="noopener noreferrer">
                Imprimir
              </Link>
            </Button>
            {isDraft && (
              <>
                <Button size="sm" variant="secondary" onClick={() => setConfirmDelete(true)}>
                  Eliminar
                </Button>
                <Button size="sm" onClick={() => setConfirmReceive(true)}>
                  Marcar como recibida
                </Button>
              </>
            )}
            {!isCancelled && !isPaid && (
              <Button size="sm" variant="danger" onClick={() => setConfirmCancel(true)}>
                Cancelar
              </Button>
            )}
          </div>
        }
      />
      <ComprasSubNav />

      <div className="flex-1 p-5 overflow-auto">
        <div className="max-w-4xl mx-auto flex flex-col gap-5">

          {actionError && (
            <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-sm text-sm text-red-700">
              {actionError}
            </div>
          )}

          {/* Header card */}
          <div className="bg-white border border-zinc-200 rounded-sm px-5 py-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wide mb-1">Factura proveedor</p>
              <h1 className="text-[20px] font-bold text-zinc-900 tracking-tight">{invoice.invoice_number}</h1>
              {invoice.supplier_invoice_number && (
                <p className="text-[13px] text-zinc-500 mt-0.5">N° proveedor: {invoice.supplier_invoice_number}</p>
              )}
              <p className="text-[13px] text-zinc-500 mt-0.5">
                {invoice.contact?.legal_name ?? 'Sin proveedor'} · {invoice.branch?.name ?? 'Sin sucursal'}
              </p>
            </div>
            <StatusBadge value={SUPPLIER_INVOICE_STATUS_LABEL[invoice.status]} />
          </div>

          {/* Metadata card */}
          <div className="bg-white border border-zinc-200 rounded-sm p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px]">
              <div>
                <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Condición de pago</p>
                <p className="text-zinc-800">{PAYMENT_CONDITION_LABEL[invoice.payment_condition] ?? invoice.payment_condition}</p>
              </div>
              <div>
                <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Vencimiento</p>
                <p className="text-zinc-800">
                  {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('es-AR') : '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Total</p>
                <p className="text-zinc-800 tabular-nums font-medium">{formatARS(invoice.total)}</p>
              </div>
              <div>
                <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Saldo</p>
                <p className={`tabular-nums font-medium ${parseFloat(invoice.balance) > 0 ? 'text-red-600' : 'text-green-700'}`}>
                  {formatARS(invoice.balance)}
                </p>
              </div>
              {invoice.buyer && (
                <div>
                  <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Comprador</p>
                  <p className="text-zinc-800">{invoice.buyer.name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Items card */}
          <div className="bg-white border border-zinc-200 rounded-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Descripción</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Cant.</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">P. Unit.</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">IVA</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(invoice.items ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-400 text-sm">Sin ítems</td>
                  </tr>
                ) : (
                  (invoice.items ?? []).map(item => (
                    <tr key={item.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-2.5 text-zinc-900">{item.description}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{parseFloat(item.quantity).toLocaleString('es-AR')}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatARS(item.unit_price)}</td>
                      <td className="px-4 py-2.5 text-right text-zinc-500">{item.iva_rate}%</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatARS(item.total)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div className="border-t border-zinc-100">
              <TotalsFooter
                subtotal={String(subtotal.toFixed(2))}
                taxAmount={String(taxAmt.toFixed(2))}
                total={String(totalAmt.toFixed(2))}
              />
            </div>
          </div>

          {/* Payments card */}
          <div className="bg-white border border-zinc-200 rounded-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-100">
              <p className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wide">Pagos registrados</p>
            </div>
            {(invoice.payments ?? []).length > 0 ? (
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">N°</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Fecha</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Método</th>
                    <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Monto</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {(invoice.payments ?? []).map(payment => (
                    <tr key={payment.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-2.5 font-mono text-[12px] text-zinc-600">{payment.payment_number}</td>
                      <td className="px-4 py-2.5 text-zinc-700">{new Date(payment.payment_date).toLocaleDateString('es-AR')}</td>
                      <td className="px-4 py-2.5 text-zinc-700">{PAYMENT_METHOD_LABEL[payment.payment_method as PaymentMethod] ?? payment.payment_method}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatARS(payment.amount)}</td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => setPaymentToDelete(payment)}
                          className="text-red-500 hover:text-red-700 text-[12px]"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="px-5 py-4 text-[13px] text-zinc-400">Sin pagos registrados</p>
            )}

            {canPay && (
              <div className="border-t border-zinc-100 px-5 py-4 space-y-3 bg-zinc-50/50">
                <p className="text-[12px] font-semibold text-zinc-600 uppercase tracking-wide">Registrar pago</p>
                {paymentError && (
                  <p className="text-sm text-red-600">{paymentError}</p>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <FormField label="Monto">
                    <CurrencyInput
                      value={paymentAmount}
                      onChange={setPaymentAmount}
                      placeholder="0,00"
                    />
                  </FormField>
                  <FormField label="Fecha">
                    <DatePicker value={paymentDate} onChange={setPaymentDate} />
                  </FormField>
                  <FormField label="Método">
                    <select
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full h-9 px-3 text-sm border border-zinc-200 rounded-md bg-white focus:outline-none"
                    >
                      {PAYMENT_METHODS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label=" ">
                    <Button size="sm" onClick={handleAddPayment} disabled={paymentSaving} className="w-full">
                      {paymentSaving ? 'Guardando…' : 'Registrar pago'}
                    </Button>
                  </FormField>
                </div>
              </div>
            )}
          </div>

          {/* Traceability card */}
          {(invoice.order ?? invoice.receipt) && (
            <div className="bg-white border border-zinc-200 rounded-sm px-5 py-4">
              <p className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wide mb-3">Documentos vinculados</p>
              <div className="flex flex-col gap-2">
                {invoice.order && (
                  <div
                    className="flex items-center justify-between cursor-pointer hover:bg-zinc-50 -mx-5 px-5 py-1.5 rounded-sm"
                    onClick={() => router.push(`/compras/ordenes/${invoice.order!.id}`)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-zinc-400 uppercase tracking-wide font-medium">Orden</span>
                      <span className="text-[13px] font-medium text-zinc-900">{invoice.order.order_number}</span>
                    </div>
                    <StatusBadge value={PURCHASE_ORDER_STATUS_LABEL[invoice.order.status]} />
                  </div>
                )}
                {invoice.receipt && (
                  <div
                    className="flex items-center justify-between cursor-pointer hover:bg-zinc-50 -mx-5 px-5 py-1.5 rounded-sm"
                    onClick={() => router.push(`/compras/recepciones/${invoice.receipt!.id}`)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-zinc-400 uppercase tracking-wide font-medium">Recepción</span>
                      <span className="text-[13px] font-medium text-zinc-900">{invoice.receipt.receipt_number}</span>
                    </div>
                    <StatusBadge value={PURCHASE_RECEIPT_STATUS_LABEL[invoice.receipt.status]} />
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      <ConfirmDialog
        open={confirmReceive}
        onOpenChange={setConfirmReceive}
        title="Marcar como recibida"
        description={`¿Confirmás que recibiste la factura ${invoice.invoice_number}?`}
        variant="warning"
        confirmLabel="Confirmar recepción"
        onConfirm={async () => { await doAction('/receive'); setConfirmReceive(false) }}
      />

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancelar factura"
        description={`¿Estás seguro de que querés cancelar la factura ${invoice.invoice_number}?`}
        variant="danger"
        confirmLabel="Cancelar factura"
        onConfirm={async () => { await doAction('/cancel'); setConfirmCancel(false) }}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Eliminar factura"
        description={`¿Estás seguro de que querés eliminar la factura ${invoice.invoice_number}?`}
        variant="danger"
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={!!paymentToDelete}
        onOpenChange={open => { if (!open) setPaymentToDelete(null) }}
        title="Eliminar pago"
        description={`¿Querés eliminar el pago ${paymentToDelete?.payment_number}?`}
        variant="danger"
        confirmLabel="Eliminar"
        onConfirm={async () => { if (paymentToDelete) await handleDeletePayment(paymentToDelete) }}
      />
    </div>
  )
}
