'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { Textarea } from '@/components/primitives/Textarea'
import { DatePicker } from '@/components/primitives/DatePicker'
import { CurrencyInput } from '@/components/primitives/CurrencyInput'
import { TotalsFooter } from '@/components/erp/TotalsFooter'
import { SearchableSelect, type SearchableSelectOption } from '@/components/erp/SearchableSelect'
import { BranchSelectField } from '@/components/erp/BranchSelectField'
import Decimal from 'decimal.js'
import { ExpensasSubNav } from '../../ExpensasSubNav'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { IVA_RATES, type IvaRate } from '@/types'

type ExpenseAccountOption = { code: string; name: string }

export function NuevaFacturaExpensaClient() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const templateId    = searchParams.get('template_id')

  const [branchId,       setBranchId]       = useState<string | null>(null)
  const [contactId,      setContactId]      = useState<string | null>(null)
  const [contactOpts,    setContactOpts]    = useState<SearchableSelectOption[]>([])
  const [description,    setDescription]    = useState('')
  const [accountCode,    setAccountCode]    = useState('')
  const [accountOpts,    setAccountOpts]    = useState<ExpenseAccountOption[]>([])
  const [invoiceNumber,  setInvoiceNumber]  = useState('')
  const [invoiceDate,    setInvoiceDate]    = useState<Date | null>(new Date())
  const [dueDate,        setDueDate]        = useState<Date | null>(new Date())
  const [subtotal,       setSubtotal]       = useState('')
  const [discountAmount, setDiscountAmount] = useState('0')
  const [ivaRate,        setIvaRate]        = useState<IvaRate>('21')
  const [notes,          setNotes]          = useState('')
  const [saving,         setSaving]         = useState(false)
  const [serverError,    setServerError]    = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const d = await fetchJson<{ data: ExpenseAccountOption[] }>(
          '/api/v1/accounting/accounts?type=expense&all=true&is_postable=true',
        )
        if (!cancelled) setAccountOpts(d.data ?? [])
      } catch {
        /* ignore — el usuario puede cargar la cuenta manualmente en Contabilidad */
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!templateId) return
    let cancelled = false
    void (async () => {
      try {
        const t = await fetchJson<{
          branch_id: string; contact_id: string; description: string
          expense_account_code: string; default_amount: string; iva_rate: IvaRate
          contact?: { legal_name: string; trade_name: string | null } | null
        }>(`/api/v1/expenses/recurring-templates/${templateId}`)
        if (cancelled) return
        setBranchId(t.branch_id)
        setContactId(t.contact_id)
        if (t.contact) {
          setContactOpts([{ value: t.contact_id, label: t.contact.legal_name, sublabel: t.contact.trade_name ?? undefined }])
        }
        setDescription(t.description)
        setAccountCode(t.expense_account_code)
        setSubtotal(t.default_amount)
        setIvaRate(t.iva_rate)
      } catch {
        /* ignore pre-fill errors */
      }
    })()
    return () => { cancelled = true }
  }, [templateId])

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

  const net   = new Decimal(subtotal || '0').minus(discountAmount || '0')
  const tax   = net.mul(new Decimal(ivaRate).div(100))
  const total = net.plus(tax)

  async function handleSave() {
    if (!branchId)   { setServerError('Elegí una sucursal.'); return }
    if (!contactId)  { setServerError('Elegí un proveedor.'); return }
    if (!description.trim()) { setServerError('Ingresá una descripción.'); return }
    if (!accountCode) { setServerError('Elegí una cuenta de gasto.'); return }

    setSaving(true)
    setServerError(null)

    const body = {
      branch_id:            branchId,
      contact_id:            contactId,
      description:           description.trim(),
      expense_account_code:  accountCode,
      invoice_number:        invoiceNumber.trim() || null,
      invoice_date:          (invoiceDate ?? new Date()).toISOString(),
      due_date:              (dueDate ?? new Date()).toISOString(),
      subtotal:              parseFloat(subtotal) || 0,
      discount_amount:       parseFloat(discountAmount) || 0,
      iva_rate:              ivaRate,
      notes:                 notes.trim() || null,
    }

    try {
      const expense = await fetchJson<{ id: string }>('/api/v1/expenses/expense-invoices', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      router.push(`/expensas/facturas/${expense.id}`)
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
          { label: 'Facturas', href: '/expensas/facturas' },
          { label: 'Nuevo gasto' },
        ]}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => router.push('/expensas/facturas')}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando…' : 'Crear gasto'}
            </Button>
          </div>
        }
      />
      <ExpensasSubNav />

      <PageBody>
        <div className="max-w-3xl mx-auto flex flex-col gap-5">

          {serverError && (
            <div className="px-4 py-2 bg-danger-bg border border-danger rounded-sm text-sm text-danger">
              {serverError}
            </div>
          )}

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
                />
              </FormField>

              <FormField label="Descripción" required className="md:col-span-2">
                <Input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Ej: Alquiler local, EDEMSA - luz"
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

              <FormField label="N° de comprobante del proveedor">
                <Input
                  value={invoiceNumber}
                  onChange={e => setInvoiceNumber(e.target.value)}
                  placeholder="Ej: 0001-00001234"
                />
              </FormField>

              <FormField label="Fecha del comprobante">
                <DatePicker value={invoiceDate} onChange={setInvoiceDate} />
              </FormField>

              <FormField label="Vencimiento">
                <DatePicker value={dueDate} onChange={setDueDate} />
              </FormField>
            </div>
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
                subtotal={net.toFixed(2)}
                taxAmount={tax.toFixed(2)}
                total={total.toFixed(2)}
              />
            </div>
          </div>

          <div className="bg-surface border border-border rounded-sm p-5">
            <FormField label="Notas">
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Notas internas…" />
            </FormField>
          </div>

        </div>
      </PageBody>
    </div>
  )
}
