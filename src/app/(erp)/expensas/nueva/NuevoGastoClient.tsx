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
  const [notes, setNotes] = useState('')
  const [frequency, setFrequency] = useState<RecurringExpenseFrequency>('monthly')
  const [nextRunDate, setNextRunDate] = useState<Date | null>(new Date())
  const [installmentCount, setInstallmentCount] = useState('12')
  const [installmentAmount, setInstallmentAmount] = useState('')
  const [planTotal, setPlanTotal] = useState('')
  const [firstDueDate, setFirstDueDate] = useState<Date | null>(new Date())
  const [installmentFrequency, setInstallmentFrequency] = useState<RecurringExpenseFrequency>('monthly')
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [createSupplierOpen, setCreateSupplierOpen] = useState(false)
  const [createSupplierSeed, setCreateSupplierSeed] = useState('')

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

  const oneOffNet = new Decimal(subtotal || '0').minus(discountAmount || '0')
  const oneOffTax = oneOffNet.mul(new Decimal(ivaRate).div(100))
  const oneOffTotal = oneOffNet.plus(oneOffTax)

  const recurringNet = new Decimal(subtotal || '0')
  const recurringTax = recurringNet.mul(new Decimal(ivaRate).div(100))
  const recurringTotal = recurringNet.plus(recurringTax)

  async function handleSave() {
    if (!branchId) { setServerError('Elegí una sucursal.'); return }
    if (!contactId) { setServerError('Elegí un proveedor.'); return }
    if (!description.trim()) { setServerError('Ingresá una descripción.'); return }
    if (!accountCode) { setServerError('Elegí una cuenta de gasto.'); return }

    setSaving(true)
    setServerError(null)

    try {
      let body: Record<string, unknown>

      if (kind === 'one_off') {
        body = {
          kind: 'one_off',
          branch_id: branchId,
          contact_id: contactId,
          description: description.trim(),
          expense_account_code: accountCode,
          invoice_number: invoiceNumber.trim() || null,
          invoice_date: (invoiceDate ?? new Date()).toISOString(),
          due_date: (dueDate ?? new Date()).toISOString(),
          subtotal: parseFloat(subtotal) || 0,
          discount_amount: parseFloat(discountAmount) || 0,
          iva_rate: ivaRate,
          notes: notes.trim() || null,
        }
      } else if (kind === 'recurring') {
        if (!nextRunDate) { setServerError('Indicá la fecha de inicio.'); setSaving(false); return }
        body = {
          kind: 'recurring',
          branch_id: branchId,
          contact_id: contactId,
          description: description.trim(),
          expense_account_code: accountCode,
          default_amount: parseFloat(subtotal) || 0,
          iva_rate: ivaRate,
          frequency,
          next_run_date: nextRunDate.toISOString(),
          is_active: true,
          notes: notes.trim() || null,
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
              <FormField label="Sucursal" required>
                <BranchSelectField value={branchId} onChange={setBranchId} />
              </FormField>
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
              <div className="bg-surface border border-border rounded-sm overflow-hidden">
                <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField label="Subtotal" required>
                    <CurrencyInput value={subtotal} onChange={setSubtotal} placeholder="0,00" />
                  </FormField>
                  <FormField label="Descuento">
                    <CurrencyInput value={discountAmount} onChange={setDiscountAmount} placeholder="0,00" />
                  </FormField>
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
                    subtotal={oneOffNet.toFixed(2)}
                    taxAmount={oneOffTax.toFixed(2)}
                    total={oneOffTotal.toFixed(2)}
                  />
                </div>
              </div>
            </>
          )}

          {kind === 'recurring' && (
            <>
              <div className="bg-surface border border-border rounded-sm p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField label="Monto por período (sin IVA)" required>
                  <CurrencyInput value={subtotal} onChange={setSubtotal} placeholder="0,00" />
                </FormField>
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
              <div className="bg-surface border border-border rounded-sm overflow-hidden">
                <TotalsFooter
                  subtotal={recurringNet.toFixed(2)}
                  taxAmount={recurringTax.toFixed(2)}
                  total={recurringTotal.toFixed(2)}
                />
              </div>
            </>
          )}

          {kind === 'installment_plan' && (
            <>
              <div className="bg-surface border border-border rounded-sm p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
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
              {planPreview && (
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
            <FormField label="Notas">
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Notas internas…" />
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
