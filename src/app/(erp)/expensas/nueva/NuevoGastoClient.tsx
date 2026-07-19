'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Decimal from 'decimal.js'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { Textarea } from '@/components/primitives/Textarea'
import { DatePicker } from '@/components/primitives/DatePicker'
import { CurrencyInput, formatARS } from '@/components/primitives/CurrencyInput'
import { TotalsFooter } from '@/components/erp/TotalsFooter'
import { SearchableSelect, type SearchableSelectOption } from '@/components/erp/SearchableSelect'
import { BranchSelectField } from '@/components/erp/BranchSelectField'
import { SupplierQuickCreateDialog } from '@/components/erp/SupplierQuickCreateDialog'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { IVA_RATES, type IvaRate } from '@/types'
import type { ExpenseCreateKind, RecurringExpenseFrequency } from '../types'
import { EXPENSE_CREATE_KIND_LABEL, RECURRING_FREQUENCY_LABEL } from '../types'

type ExpenseAccountOption = { code: string; name: string }

const CREATE_KINDS: ExpenseCreateKind[] = ['one_off', 'recurring', 'installment_plan']

type AmountMode = 'net' | 'gross'

type ExpenseLineDraft = {
  id: string
  description: string
  quantity: string
  unitPrice: string
  discountPct: string
  ivaRate: IvaRate
  accountCode: string
}

const AMOUNT_MODE_OPTIONS: Array<{ value: AmountMode; label: string }> = [
  { value: 'gross', label: 'Con IVA' },
  { value: 'net', label: 'Sin IVA' },
]

export function NuevoGastoClient() {
  const router = useRouter()

  const [kind, setKind] = useState<ExpenseCreateKind>('one_off')
  const [branchId, setBranchId] = useState<string | null>(null)
  const [contactId, setContactId] = useState<string | null>(null)
  const [contactOpts, setContactOpts] = useState<SearchableSelectOption[]>([])
  const [description, setDescription] = useState('')
  const [accountCode, setAccountCode] = useState('')
  const [accountOpts, setAccountOpts] = useState<ExpenseAccountOption[]>([])
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState<Date | null>(new Date())
  const [dueDate, setDueDate] = useState<Date | null>(new Date())
  const [subtotal, setSubtotal] = useState('')
  const [discountAmount, setDiscountAmount] = useState('0')
  const [ivaRate, setIvaRate] = useState<IvaRate>('21')
  const [amountMode, setAmountMode] = useState<AmountMode>('gross')
  const [useLineItems, setUseLineItems] = useState(false)
  const [lineItems, setLineItems] = useState<ExpenseLineDraft[]>([])
  const [notes, setNotes] = useState('')
  const [frequency, setFrequency] = useState<RecurringExpenseFrequency>('monthly')
  const [nextRunDate, setNextRunDate] = useState<Date | null>(new Date())
  const [installmentCount, setInstallmentCount] = useState('12')
  const [installmentAmount, setInstallmentAmount] = useState('')
  const [planTotal, setPlanTotal] = useState('')
  const [firstDueDate, setFirstDueDate] = useState<Date | null>(new Date())
  const [installmentFrequency, setInstallmentFrequency] = useState<RecurringExpenseFrequency>('monthly')
  const [installmentMode, setInstallmentMode] = useState<'auto' | 'manual'>('manual')
  const [manualInstallments, setManualInstallments] = useState<Array<{
    id: string
    number: string
    dueDate: Date | null
    amount: string
    status: 'pending' | 'paid'
    paidAt: Date | null
  }>>([
    { id: crypto.randomUUID(), number: '1', dueDate: new Date(), amount: '', status: 'pending', paidAt: null },
    { id: crypto.randomUUID(), number: '2', dueDate: new Date(), amount: '', status: 'pending', paidAt: null },
  ])
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [createSupplierOpen, setCreateSupplierOpen] = useState(false)
  const [createSupplierSeed, setCreateSupplierSeed] = useState('')

  function changeAmountMode(next: AmountMode) {
    if (next === amountMode) return
    const amount = parseFloat(subtotal)
    if (!Number.isNaN(amount) && amount > 0) {
      const rate = new Decimal(ivaRate).div(100)
      if (next === 'gross') {
        setSubtotal(new Decimal(amount).mul(rate.plus(1)).toFixed(2))
      } else {
        setSubtotal((rate.isZero() ? new Decimal(amount) : new Decimal(amount).div(rate.plus(1))).toFixed(2))
      }
    }
    setLineItems(current => current.map(item => {
      const itemAmount = new Decimal(item.unitPrice || '0')
      const itemRate = new Decimal(item.ivaRate).div(100)
      return {
        ...item,
        unitPrice: next === 'gross'
          ? itemAmount.mul(itemRate.plus(1)).toFixed(2)
          : (itemRate.isZero() ? itemAmount : itemAmount.div(itemRate.plus(1))).toFixed(2),
      }
    }))
    setAmountMode(next)
  }

  function addLineItem() {
    setLineItems(current => [
      ...current,
      {
        id: crypto.randomUUID(),
        description: current.length === 0 ? description : '',
        quantity: '1',
        unitPrice: '',
        discountPct: '0',
        ivaRate,
        accountCode,
      },
    ])
  }

  function updateLineItem(id: string, patch: Partial<ExpenseLineDraft>) {
    setLineItems(current => current.map(item => item.id === id ? { ...item, ...patch } : item))
  }

  function removeLineItem(id: string) {
    setLineItems(current => current.filter(item => item.id !== id))
  }

  function buildLineItems() {
    return lineItems.map((item, index) => {
      const quantity = new Decimal(item.quantity || '0')
      const enteredPrice = new Decimal(item.unitPrice || '0')
      const rate = new Decimal(item.ivaRate).div(100)
      const unitPrice = amountMode === 'gross' && !rate.isZero()
        ? enteredPrice.div(rate.plus(1))
        : enteredPrice
      return {
        description: item.description.trim(),
        quantity: quantity.toString(),
        unit_price: unitPrice.toFixed(2),
        discount_pct: new Decimal(item.discountPct || '0').toString(),
        iva_rate: item.ivaRate,
        expense_account_code: item.accountCode,
        sort_order: index,
      }
    })
  }

  const lineItemsPreview = useMemo(() => {
    const zero = new Decimal(0)
    return lineItems.reduce(
      (totals, item) => {
        const quantity = new Decimal(item.quantity || '0')
        const enteredPrice = new Decimal(item.unitPrice || '0')
        const discountPct = new Decimal(item.discountPct || '0')
        const rate = new Decimal(item.ivaRate).div(100)
        const netUnitPrice = amountMode === 'gross' && !rate.isZero()
          ? enteredPrice.div(rate.plus(1))
          : enteredPrice
        const subtotal = quantity.mul(netUnitPrice)
        const discount = subtotal.mul(discountPct).div(100)
        const taxBase = subtotal.minus(discount)
        const tax = taxBase.mul(rate)
        return {
          subtotal: totals.subtotal.plus(subtotal),
          discount: totals.discount.plus(discount),
          tax: totals.tax.plus(tax),
          total: totals.total.plus(taxBase).plus(tax),
        }
      },
      { subtotal: zero, discount: zero, tax: zero, total: zero },
    )
  }, [lineItems, amountMode])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const d = await fetchJson<{ data: ExpenseAccountOption[] }>(
          '/api/v1/accounting/accounts?type=expense&all=true&is_postable=true',
        )
        if (!cancelled) setAccountOpts(d.data ?? [])
      } catch {
        /* ignore */
      }
    })()
    return () => { cancelled = true }
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

  const planPreview = useMemo(() => {
    const count = parseInt(installmentCount, 10)
    if (!count || count < 2) return null
    const amount = parseFloat(installmentAmount)
    const total = parseFloat(planTotal)
    let gross: Decimal | null = null
    if (!Number.isNaN(total) && total > 0) gross = new Decimal(total)
    else if (!Number.isNaN(amount) && amount > 0) gross = new Decimal(amount).mul(count)
    if (!gross) return null

    const rate = new Decimal(ivaRate).div(100)
    const taxBase = gross.div(rate.plus(1))
    const tax = gross.minus(taxBase)
    const base = gross.div(count).toDecimalPlaces(2, Decimal.ROUND_DOWN)
    const cuotas: { n: number; amount: string }[] = []
    let allocated = new Decimal(0)
    for (let i = 1; i <= count; i++) {
      const a = i === count ? gross.minus(allocated) : base
      cuotas.push({ n: i, amount: a.toFixed(2) })
      allocated = allocated.plus(a)
    }
    return { gross: gross.toFixed(2), taxBase: taxBase.toFixed(2), tax: tax.toFixed(2), cuotas: cuotas.slice(0, 6), more: count > 6 ? count - 6 : 0 }
  }, [installmentCount, installmentAmount, planTotal, ivaRate])

  const amountPreview = useMemo(() => {
    const amount = new Decimal(subtotal || '0')
    const discount = amountMode === 'net' ? new Decimal(discountAmount || '0') : new Decimal(0)
    const rate = new Decimal(ivaRate).div(100)

    if (amountMode === 'gross') {
      const total = amount
      const taxBase = rate.isZero() ? total : total.div(rate.plus(1))
      const tax = total.minus(taxBase)
      return {
        subtotal: taxBase.toFixed(2),
        taxAmount: tax.toFixed(2),
        total: total.toFixed(2),
      }
    }

    const taxBase = amount.minus(discount)
    const tax = taxBase.mul(rate)
    return {
      subtotal: taxBase.toFixed(2),
      taxAmount: tax.toFixed(2),
      total: taxBase.plus(tax).toFixed(2),
    }
  }, [subtotal, discountAmount, ivaRate, amountMode])

  function resolveNetAmount(): { subtotal: number; discount_amount: number } | null {
    const amount = parseFloat(subtotal)
    if (Number.isNaN(amount) || amount < 0) return null

    if (amountMode === 'gross') {
      const rate = new Decimal(ivaRate).div(100)
      const gross = new Decimal(amount)
      const taxBase = rate.isZero() ? gross : gross.div(rate.plus(1))
      return {
        subtotal: Number(taxBase.toFixed(2)),
        discount_amount: 0,
      }
    }

    return {
      subtotal: amount,
      discount_amount: parseFloat(discountAmount) || 0,
    }
  }

  async function handleSave() {
    if (!branchId) { setServerError('Elegí una sucursal.'); return }
    if (!contactId) { setServerError('Elegí un proveedor.'); return }
    if (!description.trim()) { setServerError('Ingresá una descripción.'); return }
    if (!accountCode) { setServerError('Elegí una cuenta de gasto.'); return }
    if (useLineItems && lineItems.length === 0) {
      setServerError('Agregá al menos una línea de detalle.')
      return
    }
    if (useLineItems && lineItems.some(item =>
      !item.description.trim() ||
      !item.accountCode ||
      new Decimal(item.quantity || '0').lte(0) ||
      new Decimal(item.unitPrice || '0').lt(0)
    )) {
      setServerError('Completá la descripción, cuenta, cantidad y precio de cada línea.')
      return
    }

    setSaving(true)
    setServerError(null)

    try {
      let body: Record<string, unknown>

      if (kind === 'one_off') {
        const items = useLineItems ? buildLineItems() : undefined
        const resolved = useLineItems
          ? {
              subtotal: Number(lineItemsPreview.subtotal.toFixed(2)),
              discount_amount: Number(lineItemsPreview.discount.toFixed(2)),
            }
          : resolveNetAmount()
        if (!resolved) { setServerError('Ingresá un monto válido.'); setSaving(false); return }
        body = {
          kind: 'one_off',
          branch_id: branchId,
          contact_id: contactId,
          description: description.trim(),
          expense_account_code: accountCode,
          invoice_number: invoiceNumber.trim() || null,
          invoice_date: (invoiceDate ?? new Date()).toISOString(),
          due_date: (dueDate ?? new Date()).toISOString(),
          subtotal: resolved.subtotal,
          discount_amount: resolved.discount_amount,
          iva_rate: ivaRate,
          notes: notes.trim() || null,
          ...(items ? { items } : {}),
        }
      } else if (kind === 'recurring') {
        if (!nextRunDate) { setServerError('Indicá la fecha de inicio.'); setSaving(false); return }
        const items = useLineItems ? buildLineItems() : undefined
        const resolved = useLineItems
          ? {
              subtotal: Number(lineItemsPreview.subtotal.minus(lineItemsPreview.discount).toFixed(2)),
              discount_amount: Number(lineItemsPreview.discount.toFixed(2)),
            }
          : resolveNetAmount()
        if (!resolved || resolved.subtotal <= 0) {
          setServerError('Ingresá un monto válido.')
          setSaving(false)
          return
        }
        body = {
          kind: 'recurring',
          branch_id: branchId,
          contact_id: contactId,
          description: description.trim(),
          expense_account_code: accountCode,
          default_amount: resolved.subtotal,
          iva_rate: ivaRate,
          frequency,
          next_run_date: nextRunDate.toISOString(),
          is_active: true,
          notes: notes.trim() || null,
          ...(items ? { items } : {}),
        }
      } else if (installmentMode === 'manual') {
        if (manualInstallments.length < 1) {
          setServerError('Agregá al menos una cuota.')
          setSaving(false)
          return
        }
        if (manualInstallments.some(row =>
          !row.dueDate ||
          !row.amount ||
          Number(row.amount) <= 0 ||
          (row.status === 'paid' && !row.paidAt)
        )) {
          setServerError('Completá vencimiento, monto y fecha de pago de cada cuota cancelada.')
          setSaving(false)
          return
        }
        body = {
          kind: 'installment_plan',
          branch_id: branchId,
          contact_id: contactId,
          description: description.trim(),
          expense_account_code: accountCode,
          invoice_number: invoiceNumber.trim() || null,
          invoice_date: (invoiceDate ?? new Date()).toISOString(),
          iva_rate: ivaRate,
          discount_amount: 0,
          notes: notes.trim() || null,
          installments: manualInstallments.map((row, index) => ({
            installment_number: parseInt(row.number, 10) || index + 1,
            due_date: row.dueDate!.toISOString(),
            amount: Number(row.amount),
            status: row.status,
            paid_at: row.status === 'paid' ? row.paidAt!.toISOString() : null,
          })),
        }
      } else {
        const count = parseInt(installmentCount, 10)
        if (!count || count < 2) { setServerError('El plan necesita al menos 2 cuotas.'); setSaving(false); return }
        if (!firstDueDate) { setServerError('Indicá el primer vencimiento.'); setSaving(false); return }
        const amt = parseFloat(installmentAmount)
        const tot = parseFloat(planTotal)
        if ((Number.isNaN(amt) || amt <= 0) && (Number.isNaN(tot) || tot <= 0)) {
          setServerError('Indicá el monto de cada cuota o el total del plan.')
          setSaving(false)
          return
        }
        body = {
          kind: 'installment_plan',
          branch_id: branchId,
          contact_id: contactId,
          description: description.trim(),
          expense_account_code: accountCode,
          invoice_number: invoiceNumber.trim() || null,
          invoice_date: (invoiceDate ?? new Date()).toISOString(),
          installment_count: count,
          first_due_date: firstDueDate.toISOString(),
          installment_frequency: installmentFrequency,
          iva_rate: ivaRate,
          discount_amount: 0,
          notes: notes.trim() || null,
          ...(tot > 0 ? { total: tot } : { installment_amount: amt }),
        }
      }

      const expense = await fetchJson<{ id: string }>('/api/v1/expenses/expense-invoices', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      router.push(`/expensas/${expense.id}`)
    } catch (e) {
      setServerError(getApiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Expensas', href: '/expensas' },
          { label: 'Nuevo gasto' },
        ]}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => router.push('/expensas')}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando…' : 'Crear gasto'}
            </Button>
          </div>
        }
      />

      <PageBody>
        <div className="max-w-3xl mx-auto flex flex-col gap-5">
          {serverError && (
            <div className="px-4 py-2 bg-danger-bg border border-danger rounded-sm text-sm text-danger">
              {serverError}
            </div>
          )}

          <div className="bg-surface border border-border rounded-sm p-5 flex flex-col gap-3">
            <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide">Tipo de gasto</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de gasto">
              {CREATE_KINDS.map(k => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => setKind(k)}
                  className={`px-3 py-1.5 text-[13px] rounded-sm border transition-colors ${
                    kind === k
                      ? 'bg-surface border-border text-fg font-medium shadow-sm'
                      : 'border-transparent text-fg-muted hover:text-fg hover:bg-surface-hover/80'
                  }`}
                >
                  {EXPENSE_CREATE_KIND_LABEL[k]}
                </button>
              ))}
            </div>
            {kind === 'installment_plan' && (
              <p className="text-[12px] text-fg-muted">
                Un solo gasto por el total del plan, con calendario de cuotas. Si el proveedor factura cada cuota por separado, usá tipo Recurrente.
              </p>
            )}
            {kind === 'recurring' && (
              <p className="text-[12px] text-fg-muted">
                Crea la serie indefinida y el primer período en borrador. Los siguientes se generan por automatización.
              </p>
            )}
          </div>

          <div className="bg-surface border border-border rounded-sm p-5 flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <BranchSelectField value={branchId} onChange={setBranchId} required />
              <FormField label="Proveedor" required>
                <SearchableSelect
                  value={contactId}
                  onChange={setContactId}
                  onSearch={searchSuppliers}
                  options={contactOpts.length > 0 ? contactOpts : undefined}
                  placeholder="Buscar proveedor…"
                  createActionLabel="Crear proveedor…"
                  onCreateRequest={(query) => {
                    setCreateSupplierSeed(query)
                    setCreateSupplierOpen(true)
                  }}
                />
              </FormField>
              <FormField label="Descripción" required className="md:col-span-2">
                <Input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Ej: Alquiler local, Notebook 12 cuotas"
                />
              </FormField>
              <FormField label="Cuenta de gasto" required>
                <select
                  value={accountCode}
                  onChange={e => setAccountCode(e.target.value)}
                  className="w-full h-9 px-3 text-sm border border-border rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Elegí una cuenta…</option>
                  {accountOpts.map(a => (
                    <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
                  ))}
                </select>
              </FormField>
              {kind !== 'recurring' && (
                <FormField label="N° de comprobante del proveedor">
                  <Input
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    placeholder="Ej: 0001-00001234"
                  />
                </FormField>
              )}
            </div>
          </div>

          {(kind === 'one_off' || kind === 'recurring') && (
            <div className="bg-surface border border-border rounded-sm p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide">Composición del gasto</p>
                  <p className="text-[12px] text-fg-muted mt-0.5">
                    Usá líneas para separar conceptos, alícuotas de IVA y cuentas contables.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={!useLineItems ? 'primary' : 'secondary'}
                    onClick={() => setUseLineItems(false)}
                  >
                    Monto único
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={useLineItems ? 'primary' : 'secondary'}
                    onClick={() => {
                      setUseLineItems(true)
                      if (lineItems.length === 0) addLineItem()
                    }}
                  >
                    Líneas de detalle
                  </Button>
                </div>
              </div>

              {useLineItems && (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[12px] text-fg-muted">Los precios se ingresan {amountMode === 'gross' ? 'con IVA' : 'sin IVA'}.</p>
                    <div className="flex gap-2" role="radiogroup" aria-label="Si los precios incluyen IVA">
                      {AMOUNT_MODE_OPTIONS.map(option => (
                        <Button
                          key={option.value}
                          type="button"
                          size="sm"
                          variant={amountMode === option.value ? 'primary' : 'secondary'}
                          onClick={() => changeAmountMode(option.value)}
                          aria-pressed={amountMode === option.value}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    {lineItems.map((item, index) => (
                      <div key={item.id} className="rounded-sm border border-border bg-surface-muted/40 p-3">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                          <FormField label={`Concepto ${index + 1}`} className="md:col-span-4">
                            <Input
                              value={item.description}
                              onChange={e => updateLineItem(item.id, { description: e.target.value })}
                              placeholder="Ej: Cargo fijo"
                            />
                          </FormField>
                          <FormField label="Cantidad" className="md:col-span-1">
                            <Input
                              type="number"
                              min="0.0001"
                              step="0.0001"
                              value={item.quantity}
                              onChange={e => updateLineItem(item.id, { quantity: e.target.value })}
                            />
                          </FormField>
                          <FormField label={amountMode === 'gross' ? 'Precio c/IVA' : 'Precio s/IVA'} className="md:col-span-2">
                            <CurrencyInput
                              value={item.unitPrice}
                              onChange={value => updateLineItem(item.id, { unitPrice: value })}
                              placeholder="0,00"
                            />
                          </FormField>
                          <FormField label="Desc. %" className="md:col-span-1">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={item.discountPct}
                              onChange={e => updateLineItem(item.id, { discountPct: e.target.value })}
                            />
                          </FormField>
                          <FormField label="IVA" className="md:col-span-1">
                            <select
                              value={item.ivaRate}
                              onChange={e => updateLineItem(item.id, { ivaRate: e.target.value as IvaRate })}
                              className="w-full h-8 px-2 text-[13px] border border-border rounded-sm bg-surface focus:outline-none"
                            >
                              {IVA_RATES.map(rate => <option key={rate} value={rate}>{rate}%</option>)}
                            </select>
                          </FormField>
                          <FormField label="Cuenta" className="md:col-span-2">
                            <select
                              value={item.accountCode}
                              onChange={e => updateLineItem(item.id, { accountCode: e.target.value })}
                              className="w-full h-8 px-2 text-[13px] border border-border rounded-sm bg-surface focus:outline-none"
                            >
                              <option value="">Elegí…</option>
                              {accountOpts.map(account => (
                                <option key={account.code} value={account.code}>{account.code} · {account.name}</option>
                              ))}
                            </select>
                          </FormField>
                          <div className="md:col-span-1 flex items-end justify-end">
                            <button
                              type="button"
                              onClick={() => removeLineItem(item.id)}
                              disabled={lineItems.length === 1}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-transparent text-fg-subtle transition-colors hover:border-danger/20 hover:bg-danger/5 hover:text-danger disabled:opacity-30 disabled:pointer-events-none"
                              aria-label={`Quitar concepto ${index + 1}`}
                              title="Quitar línea"
                            >
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                <path d="M3 3l10 10M13 3L3 13"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center gap-3">
                    <Button type="button" size="sm" variant="secondary" onClick={addLineItem}>
                      Agregar línea
                    </Button>
                    <p className="text-[13px] font-semibold tabular-nums text-fg">
                      Total: {formatARS(lineItemsPreview.total.toFixed(2))}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {kind === 'one_off' && (
            <>
              <div className="bg-surface border border-border rounded-sm p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Fecha del comprobante">
                  <DatePicker value={invoiceDate} onChange={setInvoiceDate} />
                </FormField>
                <FormField label="Vencimiento">
                  <DatePicker value={dueDate} onChange={setDueDate} />
                </FormField>
              </div>
              {!useLineItems && <div className="bg-surface border border-border rounded-sm overflow-hidden">
                <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField label="El monto" className="md:col-span-3">
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Si el monto incluye IVA">
                      {AMOUNT_MODE_OPTIONS.map(option => (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={amountMode === option.value}
                          onClick={() => changeAmountMode(option.value)}
                          className={`px-3 py-1.5 text-[13px] rounded-sm border transition-colors ${
                            amountMode === option.value
                              ? 'bg-surface border-border text-fg font-medium shadow-sm'
                              : 'border-transparent text-fg-muted hover:text-fg hover:bg-surface-hover/80'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </FormField>
                  <FormField label={amountMode === 'gross' ? 'Total (con IVA)' : 'Subtotal (sin IVA)'} required>
                    <CurrencyInput value={subtotal} onChange={setSubtotal} placeholder="0,00" />
                  </FormField>
                  {amountMode === 'net' ? (
                    <FormField label="Descuento">
                      <CurrencyInput value={discountAmount} onChange={setDiscountAmount} placeholder="0,00" />
                    </FormField>
                  ) : null}
                  <FormField label="IVA">
                    <select
                      value={ivaRate}
                      onChange={e => setIvaRate(e.target.value as IvaRate)}
                      className="w-full h-9 px-3 text-sm border border-border rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {IVA_RATES.map(r => (
                        <option key={r} value={r}>{r}%</option>
                      ))}
                    </select>
                  </FormField>
                </div>
                <div className="border-t border-border">
                  <TotalsFooter
                    subtotal={amountPreview.subtotal}
                    taxAmount={amountPreview.taxAmount}
                    total={amountPreview.total}
                  />
                </div>
              </div>}
              {useLineItems && (
                <div className="bg-surface border border-border rounded-sm overflow-hidden">
                  <TotalsFooter
                    subtotal={lineItemsPreview.subtotal.toFixed(2)}
                    taxAmount={lineItemsPreview.tax.toFixed(2)}
                    total={lineItemsPreview.total.toFixed(2)}
                  />
                </div>
              )}
            </>
          )}

          {kind === 'recurring' && (
            <>
              <div className="bg-surface border border-border rounded-sm p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                {!useLineItems && <FormField label="El monto" className="md:col-span-3">
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Si el monto incluye IVA">
                    {AMOUNT_MODE_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={amountMode === option.value}
                        onClick={() => changeAmountMode(option.value)}
                        className={`px-3 py-1.5 text-[13px] rounded-sm border transition-colors ${
                          amountMode === option.value
                            ? 'bg-surface border-border text-fg font-medium shadow-sm'
                            : 'border-transparent text-fg-muted hover:text-fg hover:bg-surface-hover/80'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </FormField>}
                {!useLineItems && <FormField label={amountMode === 'gross' ? 'Monto por período (con IVA)' : 'Monto por período (sin IVA)'} required>
                  <CurrencyInput value={subtotal} onChange={setSubtotal} placeholder="0,00" />
                </FormField>}
                <FormField label="Frecuencia" required>
                  <select
                    value={frequency}
                    onChange={e => setFrequency(e.target.value as RecurringExpenseFrequency)}
                    className="w-full h-9 px-3 text-sm border border-border rounded-md bg-surface focus:outline-none"
                  >
                    {(Object.keys(RECURRING_FREQUENCY_LABEL) as RecurringExpenseFrequency[]).map(f => (
                      <option key={f} value={f}>{RECURRING_FREQUENCY_LABEL[f]}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Primer período / inicio" required>
                  <DatePicker value={nextRunDate} onChange={setNextRunDate} />
                </FormField>
                {!useLineItems && <FormField label="IVA">
                  <select
                    value={ivaRate}
                    onChange={e => setIvaRate(e.target.value as IvaRate)}
                    className="w-full h-9 px-3 text-sm border border-border rounded-md bg-surface focus:outline-none"
                  >
                    {IVA_RATES.map(r => (
                      <option key={r} value={r}>{r}%</option>
                    ))}
                  </select>
                </FormField>}
              </div>
              <div className="bg-surface border border-border rounded-sm overflow-hidden">
                <TotalsFooter
                  subtotal={useLineItems ? lineItemsPreview.subtotal.toFixed(2) : amountPreview.subtotal}
                  taxAmount={useLineItems ? lineItemsPreview.tax.toFixed(2) : amountPreview.taxAmount}
                  total={useLineItems ? lineItemsPreview.total.toFixed(2) : amountPreview.total}
                />
              </div>
            </>
          )}

          {kind === 'installment_plan' && (
            <>
              <div className="bg-surface border border-border rounded-sm p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide">Cronograma de cuotas</p>
                    <p className="text-[12px] text-fg-muted mt-0.5">
                      Usá el cronograma manual para impuestos con vencimientos irregulares o cuotas ya pagadas.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant={installmentMode === 'manual' ? 'primary' : 'secondary'} onClick={() => setInstallmentMode('manual')}>
                      Manual
                    </Button>
                    <Button type="button" size="sm" variant={installmentMode === 'auto' ? 'primary' : 'secondary'} onClick={() => setInstallmentMode('auto')}>
                      Automático
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Fecha del comprobante">
                    <DatePicker value={invoiceDate} onChange={setInvoiceDate} />
                  </FormField>
                  <FormField label="IVA">
                    <select
                      value={ivaRate}
                      onChange={e => setIvaRate(e.target.value as IvaRate)}
                      className="w-full h-9 px-3 text-sm border border-border rounded-md bg-surface focus:outline-none"
                    >
                      {IVA_RATES.map(r => (
                        <option key={r} value={r}>{r}%</option>
                      ))}
                    </select>
                  </FormField>
                </div>

                {installmentMode === 'manual' ? (
                  <div className="flex flex-col gap-3">
                    {manualInstallments.map((row, index) => (
                      <div key={row.id} className="rounded-sm border border-border bg-surface-muted/40 p-3 grid grid-cols-1 md:grid-cols-12 gap-3">
                        <FormField label="Cuota" className="md:col-span-1">
                          <Input
                            value={row.number}
                            onChange={e => setManualInstallments(current => current.map(item => item.id === row.id ? { ...item, number: e.target.value } : item))}
                          />
                        </FormField>
                        <FormField label="Vencimiento" className="md:col-span-3">
                          <DatePicker
                            value={row.dueDate}
                            onChange={value => setManualInstallments(current => current.map(item => item.id === row.id ? { ...item, dueDate: value } : item))}
                          />
                        </FormField>
                        <FormField label="Monto (con IVA)" className="md:col-span-3">
                          <CurrencyInput
                            value={row.amount}
                            onChange={value => setManualInstallments(current => current.map(item => item.id === row.id ? { ...item, amount: value } : item))}
                          />
                        </FormField>
                        <FormField label="Estado" className="md:col-span-2">
                          <select
                            value={row.status}
                            onChange={e => {
                              const status = e.target.value as 'pending' | 'paid'
                              setManualInstallments(current => current.map(item => item.id === row.id
                                ? { ...item, status, paidAt: status === 'paid' ? (item.paidAt ?? item.dueDate) : null }
                                : item))
                            }}
                            className="w-full h-8 px-2 text-[13px] border border-border rounded-sm bg-surface"
                          >
                            <option value="pending">Pendiente</option>
                            <option value="paid">Cancelada / pagada</option>
                          </select>
                        </FormField>
                        <FormField label="Pagada el" className="md:col-span-2">
                          <DatePicker
                            value={row.paidAt}
                            onChange={value => setManualInstallments(current => current.map(item => item.id === row.id ? { ...item, paidAt: value } : item))}
                            disabled={row.status !== 'paid'}
                          />
                        </FormField>
                        <div className="md:col-span-1 flex items-end justify-end">
                          <button
                            type="button"
                            disabled={manualInstallments.length === 1}
                            onClick={() => setManualInstallments(current => current.filter(item => item.id !== row.id))}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-transparent text-fg-subtle transition-colors hover:border-danger/20 hover:bg-danger/5 hover:text-danger disabled:opacity-30 disabled:pointer-events-none"
                            aria-label={`Quitar cuota ${index + 1}`}
                            title="Quitar cuota"
                          >
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                              <path d="M3 3l10 10M13 3L3 13"/>
                            </svg>
                          </button>
                        </div>
                        <p className="md:col-span-12 text-[11px] text-fg-subtle">Cuota {index + 1}</p>
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setManualInstallments(current => [
                          ...current,
                          {
                            id: crypto.randomUUID(),
                            number: String(current.length + 1),
                            dueDate: new Date(),
                            amount: '',
                            status: 'pending',
                            paidAt: null,
                          },
                        ])}
                      >
                        Agregar cuota
                      </Button>
                      <p className="text-[13px] font-semibold tabular-nums">
                        Total: {formatARS(
                          manualInstallments.reduce((sum, row) => sum.plus(row.amount || '0'), new Decimal(0)).toFixed(2),
                        )}
                        {' · '}
                        Pendiente: {formatARS(
                          manualInstallments
                            .filter(row => row.status === 'pending')
                            .reduce((sum, row) => sum.plus(row.amount || '0'), new Decimal(0))
                            .toFixed(2),
                        )}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Cantidad de cuotas" required>
                      <Input
                        type="number"
                        min={2}
                        max={360}
                        value={installmentCount}
                        onChange={e => setInstallmentCount(e.target.value)}
                      />
                    </FormField>
                    <FormField label="Frecuencia de cuotas">
                      <select
                        value={installmentFrequency}
                        onChange={e => setInstallmentFrequency(e.target.value as RecurringExpenseFrequency)}
                        className="w-full h-9 px-3 text-sm border border-border rounded-md bg-surface focus:outline-none"
                      >
                        {(Object.keys(RECURRING_FREQUENCY_LABEL) as RecurringExpenseFrequency[]).map(f => (
                          <option key={f} value={f}>{RECURRING_FREQUENCY_LABEL[f]}</option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Monto por cuota (con IVA)">
                      <CurrencyInput
                        value={installmentAmount}
                        onChange={v => { setInstallmentAmount(v); if (v) setPlanTotal('') }}
                        placeholder="0,00"
                      />
                    </FormField>
                    <FormField label="O total del plan (con IVA)">
                      <CurrencyInput
                        value={planTotal}
                        onChange={v => { setPlanTotal(v); if (v) setInstallmentAmount('') }}
                        placeholder="0,00"
                      />
                    </FormField>
                    <FormField label="Primer vencimiento" required>
                      <DatePicker value={firstDueDate} onChange={setFirstDueDate} />
                    </FormField>
                  </div>
                )}
              </div>
              {installmentMode === 'auto' && planPreview && (
                <div className="bg-surface border border-border rounded-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-border">
                    <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide">Vista previa de cuotas</p>
                  </div>
                  <ul className="px-5 py-3 text-[13px] space-y-1">
                    {planPreview.cuotas.map(c => (
                      <li key={c.n} className="flex justify-between text-fg-muted">
                        <span>Cuota {c.n}</span>
                        <span className="tabular-nums">{formatARS(c.amount)}</span>
                      </li>
                    ))}
                    {planPreview.more > 0 && (
                      <li className="text-fg-subtle">… y {planPreview.more} más</li>
                    )}
                  </ul>
                  <div className="border-t border-border">
                    <TotalsFooter
                      subtotal={planPreview.taxBase}
                      taxAmount={planPreview.tax}
                      total={planPreview.gross}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <div className="bg-surface border border-border rounded-sm p-5">
            <FormField label="Notas u observaciones">
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Información adicional, aclaraciones o referencias internas…"
              />
            </FormField>
          </div>
        </div>
      </PageBody>

      <SupplierQuickCreateDialog
        open={createSupplierOpen}
        onOpenChange={setCreateSupplierOpen}
        initialLegalName={createSupplierSeed}
        onCreated={(option) => {
          setContactOpts(prev => {
            if (prev.some(o => o.value === option.value)) return prev
            return [option, ...prev]
          })
          setContactId(option.value)
        }}
      />
    </div>
  )
}
