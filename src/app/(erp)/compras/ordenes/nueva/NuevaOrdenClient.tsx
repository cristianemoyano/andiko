'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Textarea } from '@/components/primitives/Textarea'
import { DatePicker } from '@/components/primitives/DatePicker'
import { TotalsFooter } from '@/components/erp/TotalsFooter'
import { SalesLineItemsEditor, makeEmptyLine } from '@/components/erp/SalesLineItemsEditor'
import type { LineItemInput } from '@/components/erp/SalesLineItemsEditor'
import { SearchableSelect } from '@/components/erp/SearchableSelect'
import type { SearchableSelectOption } from '@/components/erp/SearchableSelect'
import { BranchSelectField } from '@/components/erp/BranchSelectField'
import { ComprasSubNav } from '../../ComprasSubNav'
import { PAYMENT_CONDITION_LABEL } from '../../types'
import Decimal from 'decimal.js'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

const PAYMENT_CONDITIONS = Object.entries(PAYMENT_CONDITION_LABEL).map(([value, label]) => ({ value, label }))

export function NuevaOrdenClient() {
  const router = useRouter()
  const { data: session } = useSession()
  const actorName = session?.user?.impersonation?.name ?? session?.user?.name ?? null

  const [branchId,         setBranchId]         = useState<string | null>(null)
  const [contactId,        setContactId]        = useState<string | null>(null)
  const [expectedDate,     setExpectedDate]     = useState<Date | null>(null)
  const [paymentCondition, setPaymentCondition] = useState('cash')
  const [items,            setItems]            = useState<LineItemInput[]>([makeEmptyLine()])
  const [notes,            setNotes]            = useState('')
  const [internalNotes,    setInternalNotes]    = useState('')
  const [saving,           setSaving]           = useState(false)
  const [serverError,      setServerError]      = useState<string | null>(null)

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

  const subtotal = items.reduce((acc, i) => acc + (parseFloat(i.unit_price || '0') * parseFloat(i.quantity || '0')), 0)
  const taxAmt   = 0
  const totalAmt = subtotal

  async function handleSave() {
    if (!branchId) { setServerError('Elegí una sucursal.'); return }

    setSaving(true)
    setServerError(null)

    const body = {
      branch_id:         branchId,
      contact_id:        contactId,
      expected_date:     expectedDate ? expectedDate.toISOString() : null,
      payment_condition: paymentCondition,
      notes:             notes.trim() || null,
      internal_notes:    internalNotes.trim() || null,
      items: items.map(i => ({
        product_id:   i.product_id,
        variant_id:   i.variant_id,
        description:  i.description,
        quantity:     parseFloat(i.quantity) || 1,
        unit_price:   parseFloat(i.unit_price) || 0,
        discount_pct: parseFloat(i.discount_pct) || 0,
        iva_rate:     i.iva_rate,
      })),
    }

    try {
      const order = await fetchJson<{ id: string }>('/api/v1/purchases/orders', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      router.push(`/compras/ordenes/${order.id}`)
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
          { label: 'Órdenes de compra', href: '/compras/ordenes' },
          { label: 'Nueva orden' },
        ]}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => router.push('/compras/ordenes')}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando…' : 'Crear orden'}
            </Button>
          </div>
        }
      />
      <ComprasSubNav />

      <div className="flex-1 p-5 overflow-auto">
        <div className="max-w-4xl mx-auto flex flex-col gap-5">

          {serverError && (
            <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-sm text-sm text-red-700">
              {serverError}
            </div>
          )}

          {/* Header fields card */}
          <div className="bg-white border border-zinc-200 rounded-sm p-5 flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Sucursal" required>
                <BranchSelectField value={branchId} onChange={setBranchId} />
              </FormField>

              <FormField label="Proveedor">
                <SearchableSelect
                  value={contactId}
                  onChange={setContactId}
                  onSearch={searchSuppliers}
                  placeholder="Buscar proveedor…"
                />
              </FormField>

              <FormField label="Fecha esperada de entrega">
                <DatePicker value={expectedDate} onChange={setExpectedDate} />
              </FormField>

              <FormField label="Condición de pago">
                <select
                  value={paymentCondition}
                  onChange={e => setPaymentCondition(e.target.value)}
                  className="w-full h-9 px-3 text-sm border border-zinc-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {PAYMENT_CONDITIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </FormField>
              {actorName && (
                <FormField label="Comprador">
                  <p className="text-[13px] text-zinc-700 py-1.5 px-3 bg-zinc-50 border border-zinc-200 rounded-sm">{actorName}</p>
                </FormField>
              )}
            </div>
          </div>

          {/* Items + totals card */}
          <div className="bg-white border border-zinc-200 rounded-sm overflow-hidden">
            <SalesLineItemsEditor items={items} onChange={setItems} priceListId={null} />
            <div className="border-t border-zinc-100">
              <TotalsFooter
                subtotal={String(new Decimal(subtotal).toFixed(2))}
                taxAmount={String(new Decimal(taxAmt).toFixed(2))}
                total={String(new Decimal(totalAmt).toFixed(2))}
              />
            </div>
          </div>

          {/* Notes card */}
          <div className="bg-white border border-zinc-200 rounded-sm p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Notas">
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Notas para el proveedor…" />
              </FormField>
              <FormField label="Notas internas">
                <Textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={3} placeholder="Notas internas…" />
              </FormField>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
