'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Decimal from 'decimal.js'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { Button } from '@/components/primitives/Button'
import { StatusBadge } from '@/components/primitives/Badge'
import { TotalsFooter } from '@/components/erp/TotalsFooter'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { EmptyState } from '@/components/erp/EmptyState'
import { OwnerAttachmentsSection } from '@/components/erp/OwnerAttachmentsSection'
import { Dialog } from '@/components/primitives/Dialog'
import { DatePicker } from '@/components/primitives/DatePicker'
import { CurrencyInput, formatARS } from '@/components/primitives/CurrencyInput'
import { FormField } from '@/components/primitives/FormField'
import type { Expense, ExpenseInstallment, ExpensePayment, PaymentMethod } from '../types'
import {
  EXPENSE_KIND_LABEL,
  EXPENSE_STATUS_LABEL,
  INSTALLMENT_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  RECURRING_FREQUENCY_LABEL,
} from '../types'
import { fetchJson, getApiErrorMessage, isApiRequestError } from '@/lib/fetch-json'

interface GastoDetailProps {
  id: string
}

const PAYMENT_METHODS = (Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map(
  m => ({ value: m, label: PAYMENT_METHOD_LABEL[m] })
)

export function GastoDetail({ id }: GastoDetailProps) {
  const router = useRouter()
  const [expense, setExpense]   = useState<Expense | null>(null)
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [refresh, setRefresh]   = useState(0)

  const [confirmReceive, setConfirmReceive] = useState(false)
  const [confirmCancel,  setConfirmCancel]  = useState(false)
  const [confirmDelete,  setConfirmDelete]  = useState(false)
  const [actionError,    setActionError]    = useState<string | null>(null)

  const [selectedInstallments, setSelectedInstallments] = useState<string[]>([])
  const [paymentAmount, setPaymentAmount]   = useState('')
  const [paymentDate,   setPaymentDate]     = useState<Date | null>(new Date())
  const [paymentMethod, setPaymentMethod]   = useState<PaymentMethod>('transfer')
  const [paymentNotes,  setPaymentNotes]    = useState('')
  const [paymentError,  setPaymentError]    = useState<string | null>(null)
  const [paymentSaving, setPaymentSaving]   = useState(false)
  const [paymentToDelete, setPaymentToDelete] = useState<ExpensePayment | null>(null)
  const [attachPayment, setAttachPayment]   = useState<ExpensePayment | null>(null)
  const [scheduleSaving, setScheduleSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const e = await fetchJson<Expense>(`/api/v1/expenses/expense-invoices/${id}`)
        if (!mounted) return
        setExpense(e)
        setNotFound(false)
        setSelectedInstallments([])
        const bal = parseFloat(e.balance)
        setPaymentAmount(!Number.isNaN(bal) && bal > 0 ? e.balance : '')
      } catch (e) {
        if (!mounted) return
        if (isApiRequestError(e) && e.status === 404) setNotFound(true)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [id, refresh])

  async function doAction(endpoint: string, method = 'POST') {
    setActionError(null)
    try {
      await fetchJson(`/api/v1/expenses/expense-invoices/${id}${endpoint}`, { method })
      setRefresh(r => r + 1)
      return true
    } catch (e) {
      setActionError(getApiErrorMessage(e))
      return false
    }
  }

  async function handleDelete() {
    const ok = await doAction('', 'DELETE')
    if (ok) router.push('/expensas')
  }

  function toggleInstallment(inst: ExpenseInstallment) {
    if (inst.status !== 'pending') return
    setSelectedInstallments(prev => {
      const next = prev.includes(inst.id) ? prev.filter(x => x !== inst.id) : [...prev, inst.id]
      const sum = (expense?.installments ?? [])
        .filter(i => next.includes(i.id))
        .reduce((acc, i) => acc.plus(i.amount), new Decimal(0))
      setPaymentAmount(sum.gt(0) ? sum.toFixed(2) : '')
      return next
    })
  }

  async function handleAddPayment() {
    if (!expense) return
    const amount = parseFloat(paymentAmount)
    if (!amount || amount <= 0) { setPaymentError('Ingresá un monto válido'); return }

    if (expense.kind === 'installment_plan' && selectedInstallments.length === 0) {
      setPaymentError('Seleccioná al menos una cuota'); return
    }

    setPaymentSaving(true)
    setPaymentError(null)
    try {
      await fetchJson('/api/v1/expenses/expense-payments', {
        method: 'POST',
        body: JSON.stringify({
          expense_id:     expense.id,
          branch_id:      expense.branch_id,
          contact_id:     expense.contact_id,
          payment_date:   paymentDate ? paymentDate.toISOString() : new Date().toISOString(),
          amount,
          payment_method: paymentMethod,
          notes:          paymentNotes.trim() || null,
          ...(expense.kind === 'installment_plan'
            ? { installment_ids: selectedInstallments }
            : {}),
        }),
      })
      setPaymentNotes('')
      setSelectedInstallments([])
      setRefresh(r => r + 1)
    } catch (e) {
      setPaymentError(getApiErrorMessage(e))
    } finally {
      setPaymentSaving(false)
    }
  }

  async function handleDeletePayment(payment: ExpensePayment) {
    try {
      await fetchJson(`/api/v1/expenses/expense-payments/${payment.id}`, { method: 'DELETE' })
      setPaymentToDelete(null)
      setRefresh(r => r + 1)
    } catch (e) {
      setActionError(getApiErrorMessage(e))
    }
  }

  async function toggleScheduleActive() {
    if (!expense?.schedule) return
    setScheduleSaving(true)
    setActionError(null)
    try {
      await fetchJson(`/api/v1/expenses/schedules/${expense.schedule.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !expense.schedule.is_active }),
      })
      setRefresh(r => r + 1)
    } catch (e) {
      setActionError(getApiErrorMessage(e))
    } finally {
      setScheduleSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Expensas', href: '/expensas' }, { label: '…' }]} />
        <div className="flex-1 flex items-center justify-center">
          <span className="text-fg-subtle text-sm">Cargando…</span>
        </div>
      </div>
    )
  }

  if (notFound || !expense) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Expensas', href: '/expensas' }, { label: 'No encontrado' }]} />
        <EmptyState title="Gasto no encontrado" description="El gasto no existe o fue eliminado." />
      </div>
    )
  }

  const isDraft     = expense.status === 'draft'
  const isReceived  = expense.status === 'received' || expense.status === 'partially_paid'
  const isPaid      = expense.status === 'paid'
  const isCancelled = expense.status === 'cancelled'
  const canPay      = isReceived && !isPaid && !isCancelled
  const isPlan      = expense.kind === 'installment_plan'

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Expensas', href: '/expensas' },
          { label: expense.expense_number },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            {isDraft && (
              <>
                <Button size="sm" variant="secondary" onClick={() => setConfirmDelete(true)}>
                  Eliminar
                </Button>
                <Button size="sm" onClick={() => setConfirmReceive(true)}>
                  Confirmar gasto
                </Button>
              </>
            )}
            {!isCancelled && !isPaid && (
              <Button size="sm" variant="danger" onClick={() => setConfirmCancel(true)}>
                Anular
              </Button>
            )}
          </div>
        }
      />

      <PageBody>
        <div className="max-w-4xl mx-auto flex flex-col gap-5">
          {actionError && (
            <div className="px-4 py-2 bg-danger-bg border border-danger rounded-sm text-sm text-danger">
              {actionError}
            </div>
          )}

          <div className="bg-surface border border-border rounded-sm px-5 py-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide mb-1">
                {EXPENSE_KIND_LABEL[expense.kind]}
              </p>
              <h1 className="text-[20px] font-bold text-fg tracking-tight">{expense.description}</h1>
              <p className="text-[13px] text-fg-muted mt-0.5">
                {expense.expense_number}
                {expense.invoice_number && ` · N° proveedor: ${expense.invoice_number}`}
              </p>
              <p className="text-[13px] text-fg-muted mt-0.5">
                {expense.contact?.legal_name ?? 'Sin proveedor'} · {expense.branch?.name ?? 'Sin sucursal'}
              </p>
            </div>
            <div data-testid="expense-status">
              <StatusBadge value={EXPENSE_STATUS_LABEL[expense.status]} />
            </div>
          </div>

          <div className="bg-surface border border-border rounded-sm p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px]">
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Cuenta de gasto</p>
                <p className="text-fg">{expense.expense_account_code}</p>
              </div>
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">
                  {isPlan ? 'Próximo vencimiento' : 'Vencimiento'}
                </p>
                <p className="text-fg">
                  {expense.due_date ? new Date(expense.due_date).toLocaleDateString('es-AR') : '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Total</p>
                <p className="text-fg tabular-nums font-medium">{formatARS(expense.total)}</p>
              </div>
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Saldo</p>
                <p className={`tabular-nums font-medium ${parseFloat(expense.balance) > 0 ? 'text-danger' : 'text-success'}`}>
                  {formatARS(expense.balance)}
                </p>
              </div>
            </div>
          </div>

          {expense.schedule && (
            <div className="bg-surface border border-border rounded-sm px-5 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide mb-1">Serie recurrente</p>
                <p className="text-[13px] text-fg">
                  {RECURRING_FREQUENCY_LABEL[expense.schedule.frequency]} · Próxima generación:{' '}
                  {new Date(expense.schedule.next_run_date).toLocaleDateString('es-AR')}
                </p>
                <p className="text-[12px] text-fg-muted mt-0.5">
                  {expense.schedule.is_active ? 'Activa' : 'Pausada'}
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={toggleScheduleActive} disabled={scheduleSaving}>
                {expense.schedule.is_active ? 'Pausar serie' : 'Reactivar serie'}
              </Button>
            </div>
          )}

          <OwnerAttachmentsSection
            ownerType="expense"
            ownerId={expense.id}
            title="Factura / comprobante del proveedor"
          />

          <div className="bg-surface border border-border rounded-sm overflow-hidden">
            <TotalsFooter
              subtotal={expense.subtotal}
              taxAmount={expense.tax_amount}
              total={expense.total}
            />
          </div>

          {isPlan && (expense.installments?.length ?? 0) > 0 && (
            <div className="bg-surface border border-border rounded-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide">Cuotas</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-surface-muted border-b border-border">
                  <tr>
                    {canPay && <th className="w-10 px-3 py-2.5" />}
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">#</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Vencimiento</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Estado</th>
                    <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {expense.installments!.map(inst => (
                    <tr
                      key={inst.id}
                      className={`hover:bg-surface-muted/50 ${canPay && inst.status === 'pending' ? 'cursor-pointer' : ''}`}
                      onClick={() => { if (canPay) toggleInstallment(inst) }}
                    >
                      {canPay && (
                        <td className="px-3 py-2.5">
                          {inst.status === 'pending' ? (
                            <input
                              type="checkbox"
                              checked={selectedInstallments.includes(inst.id)}
                              onChange={() => toggleInstallment(inst)}
                              onClick={e => e.stopPropagation()}
                              aria-label={`Seleccionar cuota ${inst.installment_number}`}
                            />
                          ) : null}
                        </td>
                      )}
                      <td className="px-4 py-2.5 text-fg-muted">{inst.installment_number}</td>
                      <td className="px-4 py-2.5 text-fg-muted">{new Date(inst.due_date).toLocaleDateString('es-AR')}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge value={INSTALLMENT_STATUS_LABEL[inst.status]} />
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatARS(inst.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="bg-surface border border-border rounded-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide">Pagos registrados</p>
            </div>
            {(expense.payments ?? []).length > 0 ? (
              <table className="w-full text-sm">
                <thead className="bg-surface-muted border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">N°</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Fecha</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Método</th>
                    <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Monto</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(expense.payments ?? []).map(payment => (
                    <tr key={payment.id} className="hover:bg-surface-muted/50">
                      <td className="px-4 py-2.5 font-mono text-[12px] text-fg-muted">{payment.payment_number}</td>
                      <td className="px-4 py-2.5 text-fg-muted">{new Date(payment.payment_date).toLocaleDateString('es-AR')}</td>
                      <td className="px-4 py-2.5 text-fg-muted">{PAYMENT_METHOD_LABEL[payment.payment_method as PaymentMethod] ?? payment.payment_method}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatARS(payment.amount)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <button
                          onClick={() => setAttachPayment(payment)}
                          className="text-fg-muted hover:text-fg text-[12px] mr-3"
                        >
                          Adjuntar comprobante
                        </button>
                        <button
                          onClick={() => setPaymentToDelete(payment)}
                          className="text-danger hover:text-danger text-[12px]"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="px-5 py-4 text-[13px] text-fg-subtle">Sin pagos registrados</p>
            )}

            {canPay && (
              <div className="border-t border-border px-5 py-4 space-y-3 bg-surface-muted/50">
                <p className="text-[12px] font-semibold text-fg-muted uppercase tracking-wide">
                  {isPlan ? 'Pagar cuotas seleccionadas' : 'Registrar pago'}
                </p>
                {paymentError && <p className="text-sm text-danger">{paymentError}</p>}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <FormField label="Monto">
                    <CurrencyInput
                      value={paymentAmount}
                      onChange={setPaymentAmount}
                      placeholder="0,00"
                      disabled={isPlan}
                    />
                  </FormField>
                  <FormField label="Fecha">
                    <DatePicker value={paymentDate} onChange={setPaymentDate} />
                  </FormField>
                  <FormField label="Método">
                    <select
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full h-9 px-3 text-sm border border-border rounded-md bg-surface focus:outline-none"
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
        </div>
      </PageBody>

      <ConfirmDialog
        open={confirmReceive}
        onOpenChange={setConfirmReceive}
        title="Confirmar gasto"
        description={`"${expense.description}" dejará de ser borrador, se asentará en contabilidad y quedará pendiente de pago. ¿Confirmás?`}
        variant="warning"
        confirmLabel="Confirmar gasto"
        onConfirm={async () => { await doAction('/receive'); setConfirmReceive(false) }}
      />
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Anular gasto"
        description={`¿Estás seguro de que querés anular "${expense.description}"?`}
        variant="danger"
        confirmLabel="Anular gasto"
        onConfirm={async () => { await doAction('/cancel'); setConfirmCancel(false) }}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Eliminar gasto"
        description={`¿Estás seguro de que querés eliminar "${expense.description}"?`}
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
      <Dialog
        open={!!attachPayment}
        onOpenChange={open => { if (!open) setAttachPayment(null) }}
        title={`Comprobante de pago ${attachPayment?.payment_number ?? ''}`}
      >
        {attachPayment && (
          <OwnerAttachmentsSection
            ownerType="expense_payment"
            ownerId={attachPayment.id}
            title="Comprobante de pago (opcional)"
          />
        )}
      </Dialog>
    </div>
  )
}
