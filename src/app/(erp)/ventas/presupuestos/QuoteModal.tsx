'use client'

import { useState, useCallback } from 'react'
import { Dialog } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { Textarea } from '@/components/primitives/Textarea'
import { FormField } from '@/components/primitives/FormField'
import { CurrencyInput } from '@/components/primitives/CurrencyInput'
import { DateInput } from '@/components/primitives/DateInput'
import { SearchableSelect } from '@/components/erp/SearchableSelect'
import { TotalsFooter } from '@/components/erp/TotalsFooter'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import type { SearchableSelectOption } from '@/components/erp/SearchableSelect'
import { VentasBranchField } from '@/components/erp/VentasBranchField'
import type { Quote, IvaRate } from '../types'
import { PAYMENT_CONDITION_LABEL } from '../types'
import type { PaymentCondition } from '../types'
import { cn, parseResponseBodyJson } from '@/lib/utils'

const IVA_OPTIONS: { value: IvaRate; label: string }[] = [
  { value: '0',    label: '0%' },
  { value: '10.5', label: '10.5%' },
  { value: '21',   label: '21%' },
  { value: '27',   label: '27%' },
]

const PAYMENT_CONDITIONS = Object.entries(PAYMENT_CONDITION_LABEL).map(([value, label]) => ({
  value: value as PaymentCondition,
  label,
}))

interface LineItem {
  id: string
  description: string
  quantity: string
  unit_price: string
  discount_pct: string
  iva_rate: IvaRate
}

function makeEmptyLine(): LineItem {
  return {
    id:           crypto.randomUUID(),
    description:  '',
    quantity:     '1',
    unit_price:   '0',
    discount_pct: '0',
    iva_rate:     '21',
  }
}

function calcLine(item: LineItem) {
  const qty     = parseFloat(item.quantity)   || 0
  const price   = parseFloat(item.unit_price) || 0
  const discPct = parseFloat(item.discount_pct) || 0
  const iva     = parseFloat(item.iva_rate) || 0
  const subtotal       = qty * price
  const discountAmount = subtotal * discPct / 100
  const taxBase        = subtotal - discountAmount
  const taxAmount      = taxBase * iva / 100
  const total          = taxBase + taxAmount
  return { subtotal, discountAmount, taxBase, taxAmount, total }
}

function calcTotals(items: LineItem[]) {
  let subtotal = 0, discountAmount = 0, taxAmount = 0, total = 0
  const rateMap: Record<string, { base: number; amount: number }> = {}
  for (const item of items) {
    const c = calcLine(item)
    subtotal       += c.subtotal
    discountAmount += c.discountAmount
    taxAmount      += c.taxAmount
    total          += c.total
    const rate = item.iva_rate
    if (!rateMap[rate]) rateMap[rate] = { base: 0, amount: 0 }
    rateMap[rate].base   += c.taxBase
    rateMap[rate].amount += c.taxAmount
  }
  const taxBreakdown = Object.entries(rateMap)
    .filter(([, v]) => v.amount > 0)
    .map(([rate, v]) => ({ rate, base: v.base.toFixed(2), amount: v.amount.toFixed(2) }))
  return {
    subtotal:       subtotal.toFixed(2),
    discountAmount: discountAmount.toFixed(2),
    taxAmount:      taxAmount.toFixed(2),
    total:          total.toFixed(2),
    taxBreakdown,
  }
}

interface QuoteModalProps {
  open: boolean
  quote: Quote | null
  onClose: () => void
  onSaved: () => void
}

type FieldErrors = Record<string, string[]>

export function QuoteModal({ open, quote, onClose, onSaved }: QuoteModalProps) {
  const isEdit = quote !== null

  const [saving, setSaving]             = useState(false)
  const [errors, setErrors]             = useState<FieldErrors>({})
  const [serverError, setServerError]   = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [contactId, setContactId]             = useState<string | null>(quote?.contact_id ?? null)
  const [branchId, setBranchId]               = useState<string | null>(quote?.branch_id ?? null)
  const [validUntil, setValidUntil]           = useState<Date | null>(
    quote?.valid_until ? new Date(quote.valid_until) : null
  )
  const [paymentCondition, setPaymentCondition] = useState<PaymentCondition>(
    quote?.payment_condition ?? 'cash'
  )
  const [items, setItems] = useState<LineItem[]>(() => {
    if (quote?.items && quote.items.length > 0) {
      return quote.items.map(i => ({
        id:           i.id,
        description:  i.description,
        quantity:     i.quantity,
        unit_price:   i.unit_price,
        discount_pct: i.discount_pct,
        iva_rate:     i.iva_rate,
      }))
    }
    return [makeEmptyLine()]
  })

  const totals = calcTotals(items)

  const searchContacts = useCallback(async (q: string): Promise<SearchableSelectOption[]> => {
    const res = await fetch(`/api/v1/contacts?search=${encodeURIComponent(q)}&limit=20&type=customer`)
    const data = await res.json() as { data: Array<{ id: string; legal_name: string; trade_name: string | null }> }
    return data.data.map(c => ({
      value:    c.id,
      label:    c.legal_name,
      sublabel: c.trade_name ?? undefined,
    }))
  }, [])

  function updateItem(id: string, field: keyof LineItem, value: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  function addLine() {
    setItems(prev => [...prev, makeEmptyLine()])
  }

  function removeLine(id: string) {
    setItems(prev => prev.length > 1 ? prev.filter(i => i.id !== id) : prev)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    setServerError(null)

    const form = new FormData(e.currentTarget)

    if (!isEdit && !branchId) {
      setSaving(false)
      setServerError('Elegí una sucursal.')
      return
    }

    const body: Record<string, unknown> = {
      contact_id:        contactId,
      valid_until:       validUntil ? validUntil.toISOString() : null,
      payment_condition: paymentCondition,
      notes:             (form.get('notes') as string) || null,
      internal_notes:    (form.get('internal_notes') as string) || null,
      items: items.map((item, idx) => ({
        product_id:   null,
        description:  item.description,
        quantity:     parseFloat(item.quantity) || 0,
        unit_price:   parseFloat(item.unit_price) || 0,
        discount_pct: parseFloat(item.discount_pct) || 0,
        iva_rate:     item.iva_rate,
        sort_order:   idx,
      })),
    }
    if (!isEdit) body.branch_id = branchId

    const url    = isEdit ? `/api/v1/sales/quotes/${quote.id}` : '/api/v1/sales/quotes'
    const method = isEdit ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    setSaving(false)

    if (res.ok) {
      onSaved()
      return
    }

    const data = await parseResponseBodyJson<{ code?: string; details?: { fieldErrors?: FieldErrors }; error?: string }>(
      res,
    )

    if (data?.code === 'VALIDATION_ERROR' && data.details?.fieldErrors) {
      setErrors(data.details.fieldErrors)
    } else {
      setServerError(data?.error ?? `Error ${res.status}. Si persiste, revisá los logs del servidor.`)
    }
  }

  async function handleDelete() {
    if (!quote) return
    await fetch(`/api/v1/sales/quotes/${quote.id}`, { method: 'DELETE' })
    setConfirmDelete(false)
    onSaved()
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={v => { if (!v) onClose() }}
        title={isEdit ? `Editar ${quote.quote_number}` : 'Nuevo presupuesto'}
        size="xl"
      >
        <form key={`${quote?.id ?? 'new'}-${String(open)}`} onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-4">
            {/* Header fields */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <FormField label="Cliente" htmlFor="contact_id" error={errors.contact_id?.[0]}>
                  <SearchableSelect
                    id="contact_id"
                    value={contactId}
                    onChange={setContactId}
                    onSearch={searchContacts}
                    placeholder="Buscar cliente…"
                    error={!!errors.contact_id}
                  />
                </FormField>
              </div>
              <FormField label="Válido hasta" htmlFor="valid_until">
                <DateInput
                  id="valid_until"
                  value={validUntil}
                  onChange={setValidUntil}
                  placeholder="DD/MM/AAAA"
                />
              </FormField>
            </div>

            <VentasBranchField
              value={branchId}
              onChange={setBranchId}
              disabled={isEdit}
              error={errors.branch_id?.[0]}
            />

            <FormField label="Condición de pago" htmlFor="payment_condition">
              <div className="flex gap-2 flex-wrap">
                {PAYMENT_CONDITIONS.map(pc => (
                  <button
                    key={pc.value}
                    type="button"
                    onClick={() => setPaymentCondition(pc.value)}
                    className={cn(
                      'px-3 py-1 text-[12px] rounded-sm border transition-colors',
                      paymentCondition === pc.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                        : 'border-zinc-300 text-zinc-600 hover:border-zinc-400'
                    )}
                  >
                    {pc.label}
                  </button>
                ))}
              </div>
            </FormField>

            {/* Items */}
            <div>
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                Ítems
              </p>
              <div className="border border-zinc-200 rounded-sm overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200">
                      <th className="px-2 py-2 text-left font-medium text-zinc-600 w-[35%]">Descripción</th>
                      <th className="px-2 py-2 text-right font-medium text-zinc-600 w-16">Cant.</th>
                      <th className="px-2 py-2 text-right font-medium text-zinc-600 w-28">P. unitario</th>
                      <th className="px-2 py-2 text-right font-medium text-zinc-600 w-16">Desc %</th>
                      <th className="px-2 py-2 text-right font-medium text-zinc-600 w-16">IVA</th>
                      <th className="px-2 py-2 text-right font-medium text-zinc-600 w-24">Total</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => {
                      const c = calcLine(item)
                      return (
                        <tr key={item.id} className="border-b border-zinc-100 last:border-0">
                          <td className="px-2 py-1">
                            <input
                              className="w-full h-7 text-[12px] bg-transparent border-0 focus:outline-none focus:bg-white focus:border focus:border-blue-300 focus:rounded-sm px-1"
                              placeholder="Descripción del ítem"
                              value={item.description}
                              onChange={e => updateItem(item.id, 'description', e.target.value)}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              className="w-full h-7 text-[12px] text-right bg-transparent border-0 focus:outline-none focus:bg-white focus:border focus:border-blue-300 focus:rounded-sm px-1"
                              value={item.quantity}
                              onChange={e => updateItem(item.id, 'quantity', e.target.value)}
                              inputMode="decimal"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <CurrencyInput
                              className="h-7 text-[12px] text-right"
                              value={item.unit_price}
                              onChange={v => updateItem(item.id, 'unit_price', v)}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              className="w-full h-7 text-[12px] text-right bg-transparent border-0 focus:outline-none focus:bg-white focus:border focus:border-blue-300 focus:rounded-sm px-1"
                              value={item.discount_pct}
                              onChange={e => updateItem(item.id, 'discount_pct', e.target.value)}
                              inputMode="decimal"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <select
                              className="w-full h-7 text-[12px] bg-transparent border-0 focus:outline-none text-right"
                              value={item.iva_rate}
                              onChange={e => updateItem(item.id, 'iva_rate', e.target.value as IvaRate)}
                            >
                              {IVA_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums font-medium text-zinc-700">
                            ${c.total.toFixed(2)}
                          </td>
                          <td className="px-1 py-1">
                            <button
                              type="button"
                              onClick={() => removeLine(item.id)}
                              disabled={items.length === 1}
                              className="p-1 text-zinc-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              aria-label="Eliminar ítem"
                            >
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                <path d="M3 3l10 10M13 3L3 13"/>
                              </svg>
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <Button type="button" variant="ghost" size="xs" className="mt-2" onClick={addLine}>
                + Agregar ítem
              </Button>
            </div>

            {/* Totals */}
            <TotalsFooter
              subtotal={totals.subtotal}
              discountAmount={totals.discountAmount}
              taxBreakdown={totals.taxBreakdown}
              taxAmount={totals.taxAmount}
              total={totals.total}
            />

            {/* Notes */}
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Notas para el cliente" htmlFor="notes">
                <Textarea id="notes" name="notes" defaultValue={quote?.notes ?? ''} rows={2} placeholder="Condiciones, aclaraciones…" />
              </FormField>
              <FormField label="Notas internas" htmlFor="internal_notes">
                <Textarea id="internal_notes" name="internal_notes" defaultValue={quote?.internal_notes ?? ''} rows={2} placeholder="Visible solo para el equipo…" />
              </FormField>
            </div>

            {serverError && (
              <p role="alert" className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2">
                {serverError}
              </p>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
              <div>
                {isEdit && (
                  <Button type="button" variant="danger" size="sm" onClick={() => setConfirmDelete(true)} disabled={saving}>
                    Eliminar
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear presupuesto'}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Eliminar presupuesto"
        description={`¿Eliminar ${quote?.quote_number}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDelete}
      />
    </>
  )
}
