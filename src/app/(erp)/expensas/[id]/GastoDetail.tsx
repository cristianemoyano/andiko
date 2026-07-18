'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Decimal from 'decimal.js'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { StatusBadge } from '@/components/primitives/Badge'
import { TotalsFooter } from '@/components/erp/TotalsFooter'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { EmptyState } from '@/components/erp/EmptyState'
import { OwnerAttachmentsSection } from '@/components/erp/OwnerAttachmentsSection'
import { Dialog } from '@/components/primitives/Dialog'
import { DatePicker } from '@/components/primitives/DatePicker'
import { CurrencyInput, formatARS } from '@/components/primitives/CurrencyInput'
import { FormField } from '@/components/primitives/FormField'
import { Textarea } from '@/components/primitives/Textarea'
import type { Expense, ExpenseInstallment, ExpensePayment, PaymentMethod } from '../types'
import {
  EXPENSE_KIND_LABEL,
  EXPENSE_STATUS_LABEL,
  INSTALLMENT_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  RECURRING_FREQUENCY_LABEL,
} from '../types'
import { fetchJson, getApiErrorMessage, isApiRequestError } from '@/lib/fetch-json'
import { IVA_RATES, type IvaRate } from '@/types'

interface GastoDetailProps {
  id: string
}

const PAYMENT_METHODS = (Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map(
  m => ({ value: m, label: PAYMENT_METHOD_LABEL[m] })
)

type ScheduleLineDraft = {
  id: string
  description: string
  quantity: string
  unitPrice: string
  discountPct: string
  ivaRate: IvaRate
  accountCode: string
}

type ExpenseAccountOption = { code: string; name: string }

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
  const [scheduleAmountOpen, setScheduleAmountOpen] = useState(false)
  const [scheduleAmount, setScheduleAmount] = useState('')
  const [scheduleAmountMode, setScheduleAmountMode] = useState<'net' | 'gross'>('gross')
  const [scheduleLineItems, setScheduleLineItems] = useState<ScheduleLineDraft[]>([])
  const [expenseAccountOptions, setExpenseAccountOptions] = useState<ExpenseAccountOption[]>([])
  const [scheduleAmountError, setScheduleAmountError] = useState<string | null>(null)
  const [scheduleAmountFormKey, setScheduleAmountFormKey] = useState(0)

  const [editInstallment, setEditInstallment] = useState<ExpenseInstallment | null>(null)
  const [editInstallmentDate, setEditInstallmentDate] = useState<Date | null>(null)
  const [editInstallmentAmount, setEditInstallmentAmount] = useState('')
  const [editInstallmentError, setEditInstallmentError] = useState<string | null>(null)
  const [editInstallmentSaving, setEditInstallmentSaving] = useState(false)

  const [confirmRevert, setConfirmRevert] = useState(false)
  const [editStatementOpen, setEditStatementOpen] = useState(false)
  const [stmtAmountArs, setStmtAmountArs] = useState('')
  const [stmtAmountUsd, setStmtAmountUsd] = useState('')
  const [stmtFxRate, setStmtFxRate] = useState('')
  const [stmtError, setStmtError] = useState<string | null>(null)
  const [stmtSaving, setStmtSaving] = useState(false)
  const [editExpenseOpen, setEditExpenseOpen] = useState(false)
  const [editDescription, setEditDescription] = useState('')
  const [editInvoiceNumber, setEditInvoiceNumber] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editDueDate, setEditDueDate] = useState<Date | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editAmountMode, setEditAmountMode] = useState<'net' | 'gross'>('gross')
  const [editIvaRate, setEditIvaRate] = useState<IvaRate>('21')
  const [editExpenseError, setEditExpenseError] = useState<string | null>(null)
  const [editExpenseSaving, setEditExpenseSaving] = useState(false)

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

  useEffect(() => {
    if (!scheduleAmountOpen || expenseAccountOptions.length > 0) return
    void fetchJson<{ data: ExpenseAccountOption[] }>(
      '/api/v1/accounting/accounts?type=expense&all=true&is_postable=true',
    ).then(result => setExpenseAccountOptions(result.data ?? []))
      .catch(() => setExpenseAccountOptions([]))
  }, [scheduleAmountOpen, expenseAccountOptions.length])

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

  function openEditInstallment(inst: ExpenseInstallment) {
    setEditInstallment(inst)
    setEditInstallmentDate(new Date(inst.due_date))
    setEditInstallmentAmount(inst.amount)
    setEditInstallmentError(null)
  }

  async function handleSaveInstallment() {
    if (!expense || !editInstallment || !editInstallmentDate) {
      setEditInstallmentError('Elegí una fecha válida')
      return
    }
    // Amounts of pending cuotas can be adjusted while the plan isn't cancelled/paid.
    const amountEditable = expense.status !== 'paid' && expense.status !== 'cancelled'
    let amount: number | undefined
    if (amountEditable) {
      amount = parseFloat(editInstallmentAmount)
      if (!amount || amount <= 0) {
        setEditInstallmentError('Ingresá un monto válido')
        return
      }
    }
    setEditInstallmentSaving(true)
    setEditInstallmentError(null)
    try {
      await fetchJson(
        `/api/v1/expenses/expense-invoices/${expense.id}/installments/${editInstallment.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            due_date: editInstallmentDate.toISOString(),
            ...(amount !== undefined ? { amount } : {}),
          }),
        },
      )
      setEditInstallment(null)
      setRefresh(r => r + 1)
    } catch (e) {
      setEditInstallmentError(getApiErrorMessage(e))
    } finally {
      setEditInstallmentSaving(false)
    }
  }

  function openEditStatement() {
    const stmt = expense?.credit_card_statement
    if (!stmt) return
    setStmtAmountArs(new Decimal(stmt.amount_ars).toFixed(2))
    setStmtAmountUsd(parseFloat(stmt.amount_usd) > 0 ? new Decimal(stmt.amount_usd).toFixed(2) : '')
    setStmtFxRate(stmt.fx_rate ? new Decimal(stmt.fx_rate).toFixed(2) : '')
    setStmtError(null)
    setEditStatementOpen(true)
  }

  async function handleSaveStatementAmounts() {
    const stmt = expense?.credit_card_statement
    if (!stmt) return
    const ars = parseFloat(stmtAmountArs || '0')
    const usd = parseFloat(stmtAmountUsd || '0')
    const fx = parseFloat(stmtFxRate || '0')
    if (ars <= 0 && usd <= 0) {
      setStmtError('Indicá un monto en ARS y/o USD')
      return
    }
    if (usd > 0 && fx <= 0) {
      setStmtError('Indicá la cotización para convertir USD a ARS')
      return
    }
    setStmtSaving(true)
    setStmtError(null)
    try {
      await fetchJson(`/api/v1/expenses/credit-card-statements/${stmt.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          amount_ars: ars > 0 ? ars : 0,
          amount_usd: usd > 0 ? usd : 0,
          fx_rate: usd > 0 ? fx : null,
        }),
      })
      setEditStatementOpen(false)
      setRefresh(r => r + 1)
    } catch (e) {
      setStmtError(getApiErrorMessage(e))
    } finally {
      setStmtSaving(false)
    }
  }

  function openEditExpense() {
    if (!expense) return
    setEditDescription(expense.description)
    setEditInvoiceNumber(expense.invoice_number ?? '')
    setEditNotes(expense.notes ?? '')
    setEditDueDate(expense.due_date ? new Date(expense.due_date) : null)
    setEditIvaRate((expense.iva_rate ?? '21') as IvaRate)
    setEditAmountMode('gross')
    setEditAmount(new Decimal(expense.total).toFixed(2))
    setEditExpenseError(null)
    setEditExpenseOpen(true)
  }

  function changeEditAmountMode(next: 'net' | 'gross') {
    if (next === editAmountMode) return
    const rate = new Decimal(editIvaRate || '0').div(100)
    setEditAmount(current => {
      const amount = new Decimal(current || '0')
      return next === 'gross'
        ? amount.mul(rate.plus(1)).toFixed(2)
        : (rate.isZero() ? amount : amount.div(rate.plus(1))).toFixed(2)
    })
    setEditAmountMode(next)
  }

  async function handleSaveExpenseEdit() {
    if (!expense) return
    if (!editDescription.trim()) {
      setEditExpenseError('La descripción no puede quedar vacía')
      return
    }
    const canEditAmounts = expense.status === 'draft' && expense.kind !== 'installment_plan' && !(expense.items?.length)

    const payload: Record<string, unknown> = {
      description: editDescription.trim(),
      invoice_number: editInvoiceNumber.trim() || null,
      notes: editNotes.trim() || null,
      ...(editDueDate ? { due_date: editDueDate.toISOString() } : {}),
    }

    if (canEditAmounts) {
      let amount: Decimal
      try {
        amount = new Decimal(editAmount || '0')
      } catch {
        setEditExpenseError('Ingresá un monto válido')
        return
      }
      if (!amount.isPositive()) {
        setEditExpenseError('El monto debe ser mayor que cero')
        return
      }
      const rate = new Decimal(editIvaRate || '0').div(100)
      // calcExpenseTotals espera el neto (base + descuento): derivarlo del bruto si hace falta.
      const base = editAmountMode === 'gross'
        ? (rate.isZero() ? amount : amount.div(rate.plus(1)))
        : amount
      payload.subtotal = base.plus(expense.discount_amount ?? '0').toNumber()
      payload.iva_rate = editIvaRate
    }

    setEditExpenseSaving(true)
    setEditExpenseError(null)
    try {
      await fetchJson(`/api/v1/expenses/expense-invoices/${expense.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      setEditExpenseOpen(false)
      setRefresh(r => r + 1)
    } catch (e) {
      setEditExpenseError(getApiErrorMessage(e))
    } finally {
      setEditExpenseSaving(false)
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

  function openScheduleAmountDialog() {
    if (!expense?.schedule) return
    const net = new Decimal(expense.schedule.default_amount)
    const rate = new Decimal(expense.schedule.iva_rate || '0').div(100)
    const gross = net.mul(rate.plus(1))
    setScheduleAmountMode('gross')
    setScheduleAmount(gross.toFixed(2))
    setScheduleLineItems((expense.schedule.items ?? []).map(item => {
      const itemRate = new Decimal(item.iva_rate || '0').div(100)
      return {
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: new Decimal(item.unit_price).mul(itemRate.plus(1)).toFixed(2),
        discountPct: item.discount_pct,
        ivaRate: item.iva_rate as IvaRate,
        accountCode: item.expense_account_code,
      }
    }))
    setScheduleAmountError(null)
    setScheduleAmountFormKey(key => key + 1)
    setScheduleAmountOpen(true)
  }

  async function handleScheduleAmountSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!expense?.schedule) return

    if (scheduleLineItems.length > 0) {
      if (scheduleLineItems.some(item =>
        !item.description.trim() ||
        !item.accountCode ||
        new Decimal(item.quantity || '0').lte(0) ||
        new Decimal(item.unitPrice || '0').lt(0)
      )) {
        setScheduleAmountError('Completá la descripción, cuenta, cantidad y precio de cada línea.')
        return
      }
      const items = scheduleLineItems.map((item, index) => {
        const rate = new Decimal(item.ivaRate).div(100)
        const enteredPrice = new Decimal(item.unitPrice)
        const unitPrice = scheduleAmountMode === 'gross' && !rate.isZero()
          ? enteredPrice.div(rate.plus(1))
          : enteredPrice
        return {
          description: item.description.trim(),
          quantity: item.quantity,
          unit_price: unitPrice.toFixed(2),
          discount_pct: item.discountPct,
          iva_rate: item.ivaRate,
          expense_account_code: item.accountCode,
          sort_order: index,
        }
      })

      setScheduleSaving(true)
      setScheduleAmountError(null)
      try {
        await fetchJson(`/api/v1/expenses/schedules/${expense.schedule.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ items }),
        })
        setScheduleAmountOpen(false)
        setRefresh(r => r + 1)
      } catch (error) {
        setScheduleAmountError(getApiErrorMessage(error))
      } finally {
        setScheduleSaving(false)
      }
      return
    }

    const formData = new FormData(e.currentTarget)
    const rawAmount = String(formData.get('default_amount') ?? '')
      .replace(/[^\d,.-]/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
    let amount: Decimal
    try {
      amount = new Decimal(rawAmount)
    } catch {
      setScheduleAmountError('Ingresá un monto válido')
      return
    }
    if (!amount.isPositive()) {
      setScheduleAmountError('El monto debe ser mayor que cero')
      return
    }

    const rate = new Decimal(expense.schedule.iva_rate || '0').div(100)
    const netAmount = scheduleAmountMode === 'gross'
      ? (rate.isZero() ? amount : amount.div(rate.plus(1)))
      : amount

    setScheduleSaving(true)
    setScheduleAmountError(null)
    try {
      await fetchJson(`/api/v1/expenses/schedules/${expense.schedule.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ default_amount: netAmount.toFixed(2) }),
      })
      setScheduleAmountOpen(false)
      setRefresh(r => r + 1)
    } catch (e) {
      setScheduleAmountError(getApiErrorMessage(e))
    } finally {
      setScheduleSaving(false)
    }
  }

  function changeScheduleAmountMode(next: 'net' | 'gross') {
    if (next === scheduleAmountMode || !expense?.schedule) return
    const convert = (value: string, iva: string) => {
      const amount = new Decimal(value || '0')
      const rate = new Decimal(iva || '0').div(100)
      return next === 'gross'
        ? amount.mul(rate.plus(1)).toFixed(2)
        : (rate.isZero() ? amount : amount.div(rate.plus(1))).toFixed(2)
    }
    setScheduleAmount(current => convert(current, expense.schedule!.iva_rate))
    setScheduleLineItems(current => current.map(item => ({
      ...item,
      unitPrice: convert(item.unitPrice, item.ivaRate),
    })))
    setScheduleAmountMode(next)
  }

  function updateScheduleLine(id: string, patch: Partial<ScheduleLineDraft>) {
    setScheduleLineItems(current => current.map(item => item.id === id ? { ...item, ...patch } : item))
  }

  function addScheduleLine() {
    const fallbackAccount = expense?.schedule?.expense_account_code ?? ''
    setScheduleLineItems(current => [
      ...current,
      {
        id: crypto.randomUUID(),
        description: '',
        quantity: '1',
        unitPrice: '',
        discountPct: '0',
        ivaRate: (expense?.schedule?.iva_rate ?? '21') as IvaRate,
        accountCode: fallbackAccount,
      },
    ])
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
            {(isDraft || isReceived) && (
              <Button size="sm" variant="secondary" onClick={openEditExpense}>
                Editar
              </Button>
            )}
            {expense.status === 'received'
              && (expense.payments ?? []).length === 0
              && !expense.credit_card_statement && (
              <Button size="sm" variant="secondary" onClick={() => setConfirmRevert(true)}>
                Corregir
              </Button>
            )}
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
                  Próximo período: {formatARS(
                    (expense.schedule.items?.length
                      ? expense.schedule.items.reduce((sum, item) => sum.plus(item.total), new Decimal(0))
                      : new Decimal(expense.schedule.default_amount)
                        .mul(new Decimal(expense.schedule.iva_rate || '0').div(100).plus(1))
                    ).toFixed(2),
                  )}{' '}
                  (con IVA) · {expense.schedule.is_active ? 'Activa' : 'Pausada'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={openScheduleAmountDialog} disabled={scheduleSaving}>
                  {expense.schedule.items?.length ? 'Editar líneas futuras' : 'Actualizar monto'}
                </Button>
                <Button size="sm" variant="secondary" onClick={toggleScheduleActive} disabled={scheduleSaving}>
                  {expense.schedule.is_active ? 'Pausar serie' : 'Reactivar serie'}
                </Button>
              </div>
            </div>
          )}

          {expense.credit_card_statement && (
            <div className="bg-surface border border-border rounded-sm px-5 py-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide">
                  Resumen de tarjeta
                  {expense.credit_card_statement.credit_card && (
                    <>
                      {' · '}
                      <Link
                        href={`/expensas/tarjetas/${expense.credit_card_statement.credit_card_id}`}
                        className="text-fg-muted underline decoration-border-strong underline-offset-2 transition-colors hover:text-fg hover:decoration-fg"
                        title="Ver tarjeta y sus resúmenes"
                      >
                        {expense.credit_card_statement.credit_card.name}
                        {expense.credit_card_statement.credit_card.last_four
                          ? ` ····${expense.credit_card_statement.credit_card.last_four}`
                          : ''}
                      </Link>
                    </>
                  )}
                </p>
                {expense.status === 'received' && (expense.payments ?? []).length === 0 && (
                  <Button size="sm" variant="secondary" onClick={openEditStatement}>
                    Editar montos
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px]">
                <div>
                  <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Período</p>
                  <p className="text-fg">{expense.credit_card_statement.period_label}</p>
                </div>
                <div>
                  <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Consumos ARS</p>
                  <p className="text-fg tabular-nums">{formatARS(expense.credit_card_statement.amount_ars)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Consumos USD</p>
                  <p className="text-fg tabular-nums">
                    {parseFloat(expense.credit_card_statement.amount_usd) > 0
                      ? `US$ ${Number(expense.credit_card_statement.amount_usd).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Cotización</p>
                  <p className="text-fg tabular-nums">
                    {expense.credit_card_statement.fx_rate
                      ? formatARS(expense.credit_card_statement.fx_rate)
                      : '—'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-surface border border-border rounded-sm px-5 py-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide">
                Notas u observaciones
              </p>
              {(isDraft || isReceived) && (
                <button
                  type="button"
                  onClick={openEditExpense}
                  className="text-[12px] font-medium text-fg-muted transition-colors hover:text-fg"
                >
                  Editar
                </button>
              )}
            </div>
            <p className={`whitespace-pre-wrap text-[13px] ${expense.notes ? 'text-fg' : 'text-fg-subtle'}`}>
              {expense.notes || 'Sin notas u observaciones'}
            </p>
          </div>

          <OwnerAttachmentsSection
            ownerType="expense"
            ownerId={expense.id}
            title={expense.credit_card_statement ? 'Resumen (PDF) / comprobantes' : 'Factura / comprobante del proveedor'}
          />

          {(expense.items?.length ?? 0) > 0 && (
            <div className="bg-surface border border-border rounded-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide">Detalle del gasto</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-surface-muted border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Concepto</th>
                    <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Cantidad</th>
                    <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Precio</th>
                    <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">IVA</th>
                    <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {expense.items!.map(item => (
                    <tr key={item.id}>
                      <td className="px-4 py-2.5">
                        <p className="text-fg">{item.description}</p>
                        <p className="text-[11px] text-fg-subtle">{item.expense_account_code}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">{item.quantity}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">{formatARS(item.unit_price)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">{item.iva_rate}%</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatARS(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

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
                      <td className="px-4 py-2.5 text-fg-muted">
                        <span className="inline-flex items-center gap-1.5">
                          {new Date(inst.due_date).toLocaleDateString('es-AR')}
                          {inst.status === 'pending' && !isCancelled && (
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); openEditInstallment(inst) }}
                              className="p-0.5 text-fg-subtle hover:text-fg transition-colors"
                              aria-label={`Editar vencimiento de la cuota ${inst.installment_number}`}
                              title="Editar vencimiento"
                            >
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11.5 2.5l2 2L5 13l-2.5.5L3 11z"/>
                              </svg>
                            </button>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge value={INSTALLMENT_STATUS_LABEL[inst.status]} />
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          {formatARS(inst.amount)}
                          {inst.status === 'pending' && !isCancelled && !isPaid && (
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); openEditInstallment(inst) }}
                              className="p-0.5 text-fg-subtle hover:text-fg transition-colors"
                              aria-label={`Editar monto de la cuota ${inst.installment_number}`}
                              title="Editar monto"
                            >
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11.5 2.5l2 2L5 13l-2.5.5L3 11z"/>
                              </svg>
                            </button>
                          )}
                        </span>
                      </td>
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
                      className="w-full h-8 px-2.5 text-[13px] border border-border rounded-sm bg-surface focus:outline-none focus:border-ring"
                    >
                      {PAYMENT_METHODS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </FormField>
                  <div className="flex items-end">
                    <Button size="sm" onClick={handleAddPayment} disabled={paymentSaving} className="w-full">
                      {paymentSaving ? 'Guardando…' : 'Registrar pago'}
                    </Button>
                  </div>
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
        open={confirmRevert}
        onOpenChange={setConfirmRevert}
        title="Corregir gasto"
        description={`"${expense.description}" volverá a borrador para que puedas corregir sus valores. El asiento contable se revierte y se vuelve a generar al confirmar de nuevo.`}
        variant="warning"
        confirmLabel="Volver a borrador"
        onConfirm={async () => { await doAction('/revert-to-draft'); setConfirmRevert(false) }}
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
        open={scheduleAmountOpen}
        onOpenChange={setScheduleAmountOpen}
        title={scheduleLineItems.length ? 'Editar líneas recurrentes' : 'Actualizar monto recurrente'}
        description="El nuevo monto se aplicará a los próximos períodos. Los gastos ya generados y sus pagos conservarán sus valores."
        size="sm"
      >
        <form key={scheduleAmountFormKey} onSubmit={handleScheduleAmountSubmit} className="flex flex-col gap-4">
          <FormField label={scheduleLineItems.length ? 'Los precios' : 'El monto'}>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Si el monto incluye IVA">
              {([
                { value: 'gross' as const, label: 'Con IVA' },
                { value: 'net' as const, label: 'Sin IVA' },
              ]).map(option => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={scheduleAmountMode === option.value ? 'primary' : 'secondary'}
                  aria-pressed={scheduleAmountMode === option.value}
                  onClick={() => changeScheduleAmountMode(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </FormField>
          {scheduleLineItems.length > 0 ? (
            <div className="flex flex-col gap-3">
              {scheduleLineItems.map((item, index) => (
                <div key={item.id} className="rounded-sm border border-border bg-surface-muted/40 p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label={`Concepto ${index + 1}`} className="col-span-2">
                      <Input
                        value={item.description}
                        onChange={event => updateScheduleLine(item.id, { description: event.target.value })}
                      />
                    </FormField>
                    <FormField label="Cantidad">
                      <Input
                        type="number"
                        min="0.0001"
                        step="0.0001"
                        value={item.quantity}
                        onChange={event => updateScheduleLine(item.id, { quantity: event.target.value })}
                      />
                    </FormField>
                    <FormField label={scheduleAmountMode === 'gross' ? 'Precio con IVA' : 'Precio sin IVA'}>
                      <CurrencyInput
                        value={item.unitPrice}
                        onChange={value => updateScheduleLine(item.id, { unitPrice: value })}
                      />
                    </FormField>
                    <FormField label="Descuento %">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={item.discountPct}
                        onChange={event => updateScheduleLine(item.id, { discountPct: event.target.value })}
                      />
                    </FormField>
                    <FormField label="IVA">
                      <select
                        value={item.ivaRate}
                        onChange={event => updateScheduleLine(item.id, { ivaRate: event.target.value as IvaRate })}
                        className="w-full h-8 px-2 text-[13px] border border-border rounded-sm bg-surface"
                      >
                        {IVA_RATES.map(rate => <option key={rate} value={rate}>{rate}%</option>)}
                      </select>
                    </FormField>
                    <FormField label="Cuenta" className="col-span-2">
                      <select
                        value={item.accountCode}
                        onChange={event => updateScheduleLine(item.id, { accountCode: event.target.value })}
                        className="w-full h-8 px-2 text-[13px] border border-border rounded-sm bg-surface"
                      >
                        <option value="">Elegí una cuenta…</option>
                        {expenseAccountOptions.map(account => (
                          <option key={account.code} value={account.code}>{account.code} · {account.name}</option>
                        ))}
                      </select>
                    </FormField>
                    <div className="col-span-2 flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={scheduleLineItems.length === 1}
                        onClick={() => setScheduleLineItems(current => current.filter(line => line.id !== item.id))}
                      >
                        Quitar línea
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              <Button type="button" size="sm" variant="secondary" onClick={addScheduleLine}>
                Agregar línea
              </Button>
            </div>
          ) : (
            <FormField
              label={scheduleAmountMode === 'gross' ? 'Monto para próximos períodos (con IVA)' : 'Monto para próximos períodos (sin IVA)'}
              htmlFor="schedule_default_amount"
              required
              error={scheduleAmountError ?? undefined}
            >
              <CurrencyInput
                id="schedule_default_amount"
                name="default_amount"
                value={scheduleAmount}
                onChange={setScheduleAmount}
                placeholder="0,00"
                error={!!scheduleAmountError}
                disabled={scheduleSaving}
                autoFocus
              />
            </FormField>
          )}
          {scheduleAmountError && scheduleLineItems.length > 0 ? (
            <p role="alert" className="text-[12px] text-danger">{scheduleAmountError}</p>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setScheduleAmountOpen(false)} disabled={scheduleSaving}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={scheduleSaving}>
              {scheduleSaving ? 'Guardando…' : scheduleLineItems.length ? 'Guardar líneas futuras' : 'Guardar nuevo monto'}
            </Button>
          </div>
        </form>
      </Dialog>
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
      <Dialog
        open={!!editInstallment}
        onOpenChange={open => { if (!open) setEditInstallment(null) }}
        title={`Editar cuota ${editInstallment?.installment_number ?? ''}`}
        description={isDraft
          ? 'Podés cambiar la fecha de vencimiento y el monto. El total del plan se recalcula con las cuotas.'
          : 'Podés ajustar la fecha y el monto de esta cuota pendiente. El total del plan y su asiento contable se actualizan automáticamente.'}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <FormField label="Vencimiento" required error={editInstallmentError ?? undefined}>
            <DatePicker value={editInstallmentDate} onChange={setEditInstallmentDate} />
          </FormField>
          {!isCancelled && !isPaid && (
            <FormField label="Monto de la cuota" required>
              <CurrencyInput
                value={editInstallmentAmount}
                onChange={setEditInstallmentAmount}
                placeholder="0,00"
                disabled={editInstallmentSaving}
              />
            </FormField>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setEditInstallment(null)}
              disabled={editInstallmentSaving}
            >
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={handleSaveInstallment} disabled={editInstallmentSaving}>
              {editInstallmentSaving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Dialog>
      <Dialog
        open={editStatementOpen}
        onOpenChange={setEditStatementOpen}
        title={`Editar montos — ${expense.credit_card_statement?.period_label ?? ''}`}
        description="Corregí los consumos del resumen. El total del gasto y su asiento contable se actualizan automáticamente."
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <FormField label="Consumos en ARS">
            <CurrencyInput
              value={stmtAmountArs}
              onChange={setStmtAmountArs}
              placeholder="0,00"
              disabled={stmtSaving}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Consumos en USD">
              <CurrencyInput
                value={stmtAmountUsd}
                onChange={setStmtAmountUsd}
                placeholder="0,00"
                disabled={stmtSaving}
              />
            </FormField>
            <FormField label="Cotización (ARS por USD)">
              <CurrencyInput
                value={stmtFxRate}
                onChange={setStmtFxRate}
                placeholder="0,00"
                disabled={stmtSaving}
              />
            </FormField>
          </div>
          {(() => {
            const ars = parseFloat(stmtAmountArs || '0')
            const usd = parseFloat(stmtAmountUsd || '0')
            const fx = parseFloat(stmtFxRate || '0')
            const total = (ars > 0 ? ars : 0) + (usd > 0 && fx > 0 ? usd * fx : 0)
            return total > 0 ? (
              <p className="text-[12px] text-fg-muted">
                Nuevo total a pagar: <span className="font-medium text-fg tabular-nums">{formatARS(total.toFixed(2))}</span>
              </p>
            ) : null
          })()}
          {stmtError && <p role="alert" className="text-[12px] text-danger">{stmtError}</p>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setEditStatementOpen(false)}
              disabled={stmtSaving}
            >
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={handleSaveStatementAmounts} disabled={stmtSaving}>
              {stmtSaving ? 'Guardando…' : 'Guardar montos'}
            </Button>
          </div>
        </div>
      </Dialog>
      <Dialog
        open={editExpenseOpen}
        onOpenChange={setEditExpenseOpen}
        title="Editar gasto"
        description={isDraft
          ? 'El gasto está en borrador: podés corregir todos sus datos antes de confirmarlo.'
          : 'El gasto ya está confirmado: solo se editan datos descriptivos. Para cambiar montos usá "Corregir".'}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <FormField label="Descripción" required>
            <Input
              value={editDescription}
              onChange={e => setEditDescription(e.target.value)}
              disabled={editExpenseSaving}
            />
          </FormField>
          <FormField label="N° comprobante del proveedor">
            <Input
              value={editInvoiceNumber}
              onChange={e => setEditInvoiceNumber(e.target.value)}
              placeholder="0001-00001234"
              disabled={editExpenseSaving}
            />
          </FormField>
          <FormField label="Notas u observaciones">
            <Textarea
              value={editNotes}
              onChange={e => setEditNotes(e.target.value)}
              rows={3}
              placeholder="Información adicional, aclaraciones o referencias internas…"
              disabled={editExpenseSaving}
            />
          </FormField>
          {!isPlan && (
            <FormField label="Vencimiento">
              <DatePicker value={editDueDate} onChange={setEditDueDate} />
            </FormField>
          )}
          {isDraft && !isPlan && !(expense.items?.length) && (
            <>
              <FormField label="El monto">
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Si el monto incluye IVA">
                  {([
                    { value: 'gross' as const, label: 'Con IVA' },
                    { value: 'net' as const, label: 'Sin IVA' },
                  ]).map(option => (
                    <Button
                      key={option.value}
                      type="button"
                      size="sm"
                      variant={editAmountMode === option.value ? 'primary' : 'secondary'}
                      aria-pressed={editAmountMode === option.value}
                      onClick={() => changeEditAmountMode(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label={editAmountMode === 'gross' ? 'Monto (con IVA)' : 'Monto (sin IVA)'} required>
                  <CurrencyInput
                    value={editAmount}
                    onChange={setEditAmount}
                    placeholder="0,00"
                    disabled={editExpenseSaving}
                  />
                </FormField>
                <FormField label="IVA">
                  <select
                    value={editIvaRate}
                    onChange={e => setEditIvaRate(e.target.value as IvaRate)}
                    className="w-full h-9 px-3 text-sm border border-border rounded-md bg-surface focus:outline-none"
                    disabled={editExpenseSaving}
                  >
                    {IVA_RATES.map(rate => <option key={rate} value={rate}>{rate}%</option>)}
                  </select>
                </FormField>
              </div>
            </>
          )}
          {isDraft && isPlan && (
            <p className="text-[12px] text-fg-muted">
              El total del plan surge de sus cuotas: editá el monto de cada cuota desde la tabla.
            </p>
          )}
          {isDraft && (expense.items?.length ?? 0) > 0 && (
            <p className="text-[12px] text-fg-muted">
              Este gasto tiene líneas de detalle: los montos surgen de sus líneas.
            </p>
          )}
          {editExpenseError && <p role="alert" className="text-[12px] text-danger">{editExpenseError}</p>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setEditExpenseOpen(false)}
              disabled={editExpenseSaving}
            >
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={handleSaveExpenseEdit} disabled={editExpenseSaving}>
              {editExpenseSaving ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
