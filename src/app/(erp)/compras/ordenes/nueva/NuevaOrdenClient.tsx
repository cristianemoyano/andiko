'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { TopBar } from '@/components/layout/TopBar'
import { FormSection, PageBody } from '@/components/layout'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Textarea } from '@/components/primitives/Textarea'
import { DatePicker } from '@/components/primitives/DatePicker'
import { TotalsFooter } from '@/components/erp/TotalsFooter'
import { PaymentConditionSelector } from '@/components/erp/PaymentConditionSelector'
import { SalesLineItemsEditor, calcTotals, makeEmptyLine } from '@/components/erp/SalesLineItemsEditor'
import type { LineItemInput } from '@/components/erp/SalesLineItemsEditor'
import { consumePurchaseOrderDraft } from '@/lib/purchase-order-draft'
import { SearchableSelect } from '@/components/erp/SearchableSelect'
import type { SearchableSelectOption } from '@/components/erp/SearchableSelect'
import { BranchSelectField } from '@/components/erp/BranchSelectField'
import { ComprasSubNav } from '../../ComprasSubNav'
import Decimal from 'decimal.js'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifyError } from '@/lib/notify'
import type { PaymentCondition } from '@/types'

export function NuevaOrdenClient() {
  const router = useRouter()
  const { data: session } = useSession()
  const actorName = session?.user?.impersonation?.name ?? session?.user?.name ?? null

  const [branchId,         setBranchId]         = useState<string | null>(null)
  const [contactId,        setContactId]        = useState<string | null>(null)
  const [expectedDate,     setExpectedDate]     = useState<Date | null>(null)
  const [paymentCondition, setPaymentCondition] = useState<PaymentCondition>('cash')
  const [items,            setItems]            = useState<LineItemInput[]>([makeEmptyLine()])
  const [notes,            setNotes]            = useState('')
  const [internalNotes,    setInternalNotes]    = useState('')
  const [saving,           setSaving]           = useState(false)
  const [serverError,      setServerError]      = useState<string | null>(null)

  useEffect(() => {
    const draft = consumePurchaseOrderDraft()
    if (!draft) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate once from sessionStorage draft
    setItems(draft.items.map(item => ({
      id:           crypto.randomUUID(),
      product_id:   item.product_id,
      variant_id:   item.variant_id,
      description:  item.description,
      quantity:     item.quantity,
      unit_price:   '0',
      discount_pct: '0',
      iva_rate:     '21',
    })))
    if (draft.notes) setNotes(draft.notes)
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

  const totals = calcTotals(items)

  function reportError(message: string) {
    setServerError(message)
    notifyError(message)
  }

  async function handleSave() {
    if (!branchId) {
      reportError('Elegí una sucursal.')
      return
    }

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
      reportError(getApiErrorMessage(e))
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

      <PageBody>
        <div className="max-w-4xl mx-auto flex flex-col gap-5">
          <div className="pt-1">
            <h1 className="text-xl font-semibold tracking-tight text-fg">Nueva orden de compra</h1>
            <p className="mt-0.5 text-[13px] text-fg-muted">
              Elegí el proveedor, cargá los productos y prepará la orden para enviarla.
            </p>
          </div>

          {serverError && (
            <div role="alert" className="rounded-sm border border-danger bg-danger-bg px-4 py-2 text-sm text-danger">
              {serverError}
            </div>
          )}

          {/* Header fields card */}
          <FormSection title="Datos generales">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <BranchSelectField value={branchId} onChange={setBranchId} required />

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
                <PaymentConditionSelector value={paymentCondition} onChange={setPaymentCondition} />
              </FormField>
              {actorName && (
                <FormField label="Comprador">
                  <p className="flex h-9 items-center rounded-sm border border-border bg-surface-muted px-3 text-sm text-fg-muted">{actorName}</p>
                </FormField>
              )}
            </div>
          </FormSection>

          {/* Items + totals card */}
          <FormSection>
            <SalesLineItemsEditor items={items} onChange={setItems} priceListId={null} />
          </FormSection>
          <TotalsFooter
            subtotal={new Decimal(totals.subtotal).toFixed(2)}
            taxAmount={new Decimal(totals.taxAmount).toFixed(2)}
            total={new Decimal(totals.total).toFixed(2)}
            className="w-full max-w-sm self-end"
          />

          {/* Notes card */}
          <FormSection title="Notas">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Notas">
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Notas para el proveedor…" />
              </FormField>
              <FormField label="Notas internas">
                <Textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={3} placeholder="Notas internas…" />
              </FormField>
            </div>
          </FormSection>

        </div>
      </PageBody>
    </div>
  )
}
