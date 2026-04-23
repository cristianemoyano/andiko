'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Textarea } from '@/components/primitives/Textarea'
import { DatePicker } from '@/components/primitives/DatePicker'
import { TotalsFooter } from '@/components/erp/TotalsFooter'
import { SalesLineItemsEditor, calcTotals, makeEmptyLine } from '@/components/erp/SalesLineItemsEditor'
import type { LineItemInput } from '@/components/erp/SalesLineItemsEditor'
import { SearchableSelect } from '@/components/erp/SearchableSelect'
import type { SearchableSelectOption } from '@/components/erp/SearchableSelect'
import { VentasBranchField } from '@/components/erp/VentasBranchField'
import type { PaymentCondition } from '../../types'
import { PAYMENT_CONDITION_LABEL } from '../../types'
import { VentasSubNav } from '../../VentasSubNav'
import { cn, parseResponseBodyJson } from '@/lib/utils'

const PAYMENT_CONDITIONS = Object.entries(PAYMENT_CONDITION_LABEL).map(([value, label]) => ({
  value: value as PaymentCondition,
  label,
}))

type FieldErrors = Record<string, string[]>

export function NuevoPedidoClient() {
  const router = useRouter()

  const [contactId, setContactId]               = useState<string | null>(null)
  const [branchId, setBranchId]                 = useState<string | null>(null)
  const [priceListId, setPriceListId]           = useState<string | null>(null)
  const [requiredDate, setRequiredDate]         = useState<Date | null>(null)
  const [paymentCondition, setPaymentCondition] = useState<PaymentCondition>('cash')
  const [items, setItems]                       = useState<LineItemInput[]>([makeEmptyLine()])
  const [notes, setNotes]                       = useState('')
  const [internalNotes, setInternalNotes]       = useState('')
  const [saving, setSaving]                     = useState(false)
  const [errors, setErrors]                     = useState<FieldErrors>({})
  const [serverError, setServerError]           = useState<string | null>(null)

  const totals = calcTotals(items)

  const searchContacts = useCallback(async (q: string): Promise<SearchableSelectOption[]> => {
    const res = await fetch(`/api/v1/contacts?search=${encodeURIComponent(q)}&limit=20&type=customer`)
    const data = await res.json() as { data: Array<{ id: string; legal_name: string; trade_name: string | null }> }
    return data.data.map(c => ({ value: c.id, label: c.legal_name, sublabel: c.trade_name ?? undefined }))
  }, [])

  const searchPriceLists = useCallback(async (q: string): Promise<SearchableSelectOption[]> => {
    const res = await fetch(`/api/v1/catalog/price-lists?search=${encodeURIComponent(q)}&limit=20`)
    const data = await res.json() as { data: Array<{ id: string; name: string }> }
    return (data.data ?? []).map(pl => ({ value: pl.id, label: pl.name }))
  }, [])

  async function handleSave() {
    setSaving(true)
    setErrors({})
    setServerError(null)

    if (!branchId) {
      setSaving(false)
      setServerError('Elegí una sucursal.')
      return
    }

    const body = {
      contact_id:        contactId,
      branch_id:         branchId,
      price_list_id:     priceListId,
      required_date:     requiredDate ? requiredDate.toISOString() : null,
      payment_condition: paymentCondition,
      notes:             notes.trim() || null,
      internal_notes:    internalNotes.trim() || null,
      items: items.map((item, idx) => ({
        product_id:   item.product_id ?? null,
        description:  item.description,
        quantity:     parseFloat(item.quantity) || 0,
        unit_price:   parseFloat(item.unit_price) || 0,
        discount_pct: parseFloat(item.discount_pct) || 0,
        iva_rate:     item.iva_rate,
        sort_order:   idx,
      })),
    }

    const res = await fetch('/api/v1/sales/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    setSaving(false)

    if (res.ok) {
      const order = await res.json() as { id: string }
      router.push(`/ventas/pedidos/${order.id}`)
      return
    }

    const data = await parseResponseBodyJson<{ code?: string; details?: { fieldErrors?: FieldErrors }; error?: string }>(res)
    if (data?.code === 'VALIDATION_ERROR' && data.details?.fieldErrors) {
      setErrors(data.details.fieldErrors)
    } else {
      setServerError(data?.error ?? `Error ${res.status}. Si persiste, revisá los logs.`)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Ventas', href: '/ventas/presupuestos' },
          { label: 'Pedidos', href: '/ventas/pedidos' },
          { label: 'Nuevo pedido' },
        ]}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => router.push('/ventas/pedidos')} disabled={saving}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando…' : 'Crear pedido'}
            </Button>
          </div>
        }
      />
      <VentasSubNav />

      <div className="flex-1 p-5 overflow-auto">
        <div className="max-w-4xl mx-auto flex flex-col gap-5">
          {/* Header fields */}
          <div className="bg-white border border-zinc-200 rounded-sm p-5 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
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
              <FormField label="Fecha requerida" htmlFor="required_date">
                <DatePicker id="required_date" value={requiredDate} onChange={setRequiredDate} placeholder="Seleccionar fecha" />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <VentasBranchField value={branchId} onChange={setBranchId} error={errors.branch_id?.[0]} />
              <FormField label="Lista de precios" htmlFor="price_list_id">
                <SearchableSelect
                  id="price_list_id"
                  value={priceListId}
                  onChange={setPriceListId}
                  onSearch={searchPriceLists}
                  placeholder="Sin lista de precios"
                  clearable
                />
              </FormField>
            </div>

            <FormField label="Condición de pago">
              <div className="flex gap-2 flex-wrap">
                {PAYMENT_CONDITIONS.map(pc => (
                  <button
                    key={pc.value}
                    type="button"
                    onClick={() => setPaymentCondition(pc.value)}
                    className={cn(
                      'px-3 py-1 text-[12px] rounded-sm border transition-colors',
                      paymentCondition === pc.value
                        ? 'border-brand-600 bg-brand-50 text-brand-600 font-medium'
                        : 'border-zinc-300 text-zinc-600 hover:border-zinc-400'
                    )}
                  >
                    {pc.label}
                  </button>
                ))}
              </div>
            </FormField>
          </div>

          {/* Line items */}
          <div className="bg-white border border-zinc-200 rounded-sm p-5">
            <SalesLineItemsEditor items={items} onChange={setItems} priceListId={priceListId} />
          </div>

          {/* Totals */}
          <TotalsFooter
            subtotal={totals.subtotal}
            discountAmount={totals.discountAmount}
            taxBreakdown={totals.taxBreakdown}
            taxAmount={totals.taxAmount}
            total={totals.total}
            className="max-w-xs self-end"
          />

          {/* Notes */}
          <div className="bg-white border border-zinc-200 rounded-sm p-5">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Notas para el cliente" htmlFor="notes">
                <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Condiciones, aclaraciones…" />
              </FormField>
              <FormField label="Notas internas" htmlFor="internal_notes">
                <Textarea id="internal_notes" value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={3} placeholder="Visible solo para el equipo…" />
              </FormField>
            </div>
          </div>

          {serverError && (
            <p role="alert" className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2">
              {serverError}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
