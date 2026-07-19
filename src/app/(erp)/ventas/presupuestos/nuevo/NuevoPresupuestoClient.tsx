'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody, FormSection } from '@/components/layout'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Textarea } from '@/components/primitives/Textarea'
import { DatePicker } from '@/components/primitives/DatePicker'
import { TotalsFooter } from '@/components/erp/TotalsFooter'
import { PaymentConditionSelector } from '@/components/erp/PaymentConditionSelector'
import { SalesLineItemsEditor, calcTotals, makeEmptyLine } from '@/components/erp/SalesLineItemsEditor'
import type { LineItemInput } from '@/components/erp/SalesLineItemsEditor'
import { catalogProductRequiredMessage, findLineWithoutCatalogProduct, findLineExceedingBranchStock, insufficientBranchStockMessage, type BranchStockMap } from '@/lib/sales-line-items-form'
import { SearchableSelect } from '@/components/erp/SearchableSelect'
import type { SearchableSelectOption } from '@/components/erp/SearchableSelect'
import { VentasBranchField } from '@/components/erp/VentasBranchField'
import type { PaymentCondition } from '../../types'
import { VentasSubNav } from '../../VentasSubNav'
import { CustomerQuickCreateDialog } from '../../CustomerQuickCreateDialog'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifyError } from '@/lib/notify'
import { fieldErrorsFromApiError } from '@/lib/validation-errors'

type FieldErrors = Record<string, string[]>

export function NuevoPresupuestoClient() {
  const router = useRouter()
  const { data: session } = useSession()
  const actorName = session?.user?.impersonation?.name ?? session?.user?.name ?? null

  const [contactId, setContactId]               = useState<string | null>(null)
  const [contactOption, setContactOption]       = useState<SearchableSelectOption | null>(null)
  const [branchId, setBranchId]                 = useState<string | null>(null)
  const [priceListId, setPriceListId]           = useState<string | null>(null)
  const [validUntil, setValidUntil]             = useState<Date | null>(null)
  const [paymentCondition, setPaymentCondition] = useState<PaymentCondition>('cash')
  const [items, setItems]                       = useState<LineItemInput[]>([makeEmptyLine()])
  const [branchStockMap, setBranchStockMap]     = useState<BranchStockMap>({})
  const [notes, setNotes]                       = useState('')
  const [internalNotes, setInternalNotes]       = useState('')
  const [saving, setSaving]                     = useState(false)
  const [errors, setErrors]                     = useState<FieldErrors>({})
  const [serverError, setServerError]           = useState<string | null>(null)
  const [createContactOpen, setCreateContactOpen] = useState(false)
  const [createContactSeed, setCreateContactSeed] = useState('')

  const totals = calcTotals(items)

  function reportError(message: string) {
    setServerError(message)
    notifyError(message)
  }

  const searchContacts = useCallback(async (q: string): Promise<SearchableSelectOption[]> => {
    try {
      const data = await fetchJson<{ data: Array<{ id: string; legal_name: string; trade_name: string | null }> }>(
        `/api/v1/contacts?search=${encodeURIComponent(q)}&limit=20&type=customer`,
      )
      return data.data.map(c => ({ value: c.id, label: c.legal_name, sublabel: c.trade_name ?? undefined }))
    } catch {
      return []
    }
  }, [])

  const searchPriceLists = useCallback(async (q: string): Promise<SearchableSelectOption[]> => {
    try {
      const data = await fetchJson<{ data: Array<{ id: string; name: string }> }>(
        `/api/v1/catalog/price-lists?search=${encodeURIComponent(q)}&limit=20`,
      )
      return (data.data ?? []).map(pl => ({ value: pl.id, label: pl.name }))
    } catch {
      return []
    }
  }, [])

  const handleStockMapChange = useCallback((map: BranchStockMap) => {
    setBranchStockMap(map)
  }, [])

  async function handleSave() {
    setSaving(true)
    setErrors({})
    setServerError(null)

    if (!branchId) {
      setSaving(false)
      reportError('Elegí una sucursal.')
      return
    }
    if (!contactId) {
      setSaving(false)
      setErrors(prev => ({ ...prev, contact_id: ['Seleccioná un cliente.'] }))
      notifyError('Seleccioná un cliente.')
      return
    }

    const lineWithoutProduct = findLineWithoutCatalogProduct(items)
    if (lineWithoutProduct >= 0) {
      setSaving(false)
      reportError(catalogProductRequiredMessage(lineWithoutProduct))
      return
    }

    const lineOverStock = findLineExceedingBranchStock(items, branchStockMap)
    if (lineOverStock >= 0) {
      setSaving(false)
      reportError(insufficientBranchStockMessage(lineOverStock))
      return
    }

    const body = {
      contact_id:        contactId,
      branch_id:         branchId,
      price_list_id:     priceListId,
      valid_until:       validUntil ? validUntil.toISOString() : null,
      payment_condition: paymentCondition,
      notes:             notes.trim() || null,
      internal_notes:    internalNotes.trim() || null,
      items: items.map((item, idx) => ({
        product_id:   item.product_id ?? null,
        variant_id:   item.variant_id ?? null,
        description:  item.description,
        quantity:     parseFloat(item.quantity) || 0,
        unit_price:   parseFloat(item.unit_price) || 0,
        discount_pct: parseFloat(item.discount_pct) || 0,
        iva_rate:     item.iva_rate,
        sort_order:   idx,
      })),
    }

    try {
      const quote = await fetchJson<{ id: string }>('/api/v1/sales/quotes', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      router.push(`/ventas/presupuestos/${quote.id}`)
    } catch (err) {
      const fe = fieldErrorsFromApiError(err)
      if (fe) {
        setErrors(fe)
        const hasItemsErrors = Object.keys(fe).some(k => k.startsWith('items'))
        if (hasItemsErrors) {
          reportError('Hay errores en los ítems. Revisá producto, descripción, cantidad y precio.')
        } else {
          notifyError('Revisá los campos marcados e intentá de nuevo.')
        }
      } else {
        reportError(getApiErrorMessage(err))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Ventas', href: '/ventas/presupuestos' },
          { label: 'Presupuestos', href: '/ventas/presupuestos' },
          { label: 'Nuevo presupuesto' },
        ]}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => router.push('/ventas/presupuestos')} disabled={saving}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando…' : 'Crear presupuesto'}
            </Button>
          </div>
        }
      />
      <VentasSubNav />

      <PageBody>
        <div className="max-w-4xl mx-auto flex flex-col gap-5">
          {/* Page header */}
          <div className="pt-1">
            <h1 className="text-xl font-semibold tracking-tight text-fg">Nuevo presupuesto</h1>
            <p className="mt-0.5 text-[13px] text-fg-muted">
              Elegí el cliente, cargá los ítems y creá el presupuesto para enviarlo.
            </p>
          </div>

          {serverError && (
            <p role="alert" className="text-[13px] text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">
              {serverError}
            </p>
          )}

          {/* Header fields */}
          <FormSection title="Datos generales">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Cliente" htmlFor="contact_id" error={errors.contact_id?.[0]}>
                <SearchableSelect
                  id="contact_id"
                  value={contactId}
                  onChange={(next) => {
                    setContactId(next)
                    if (!next) setContactOption(null)
                  }}
                  onSelect={setContactOption}
                  options={contactOption ? [contactOption] : []}
                  onSearch={searchContacts}
                  onCreateRequest={(query) => {
                    setCreateContactSeed(query)
                    setCreateContactOpen(true)
                  }}
                  createActionLabel="Crear cliente…"
                  placeholder="Buscar cliente…"
                  error={!!errors.contact_id}
                />
              </FormField>
              <FormField label="Válido hasta" htmlFor="valid_until">
                <DatePicker id="valid_until" value={validUntil} onChange={setValidUntil} placeholder="Seleccionar fecha" />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Condición de pago">
                <PaymentConditionSelector value={paymentCondition} onChange={setPaymentCondition} />
              </FormField>
              {actorName && (
                <FormField label="Vendedor">
                  <p className="flex h-9 items-center text-sm text-fg-muted px-3 bg-surface-muted border border-border rounded-sm">{actorName}</p>
                </FormField>
              )}
            </div>
          </FormSection>

          {/* Line items */}
          <FormSection>
            <SalesLineItemsEditor
              items={items}
              onChange={setItems}
              priceListId={priceListId}
              branchId={branchId}
              onStockMapChange={handleStockMapChange}
            />
          </FormSection>

          {/* Totals */}
          <TotalsFooter
            subtotal={totals.subtotal}
            discountAmount={totals.discountAmount}
            taxBreakdown={totals.taxBreakdown}
            taxAmount={totals.taxAmount}
            total={totals.total}
            className="w-full max-w-sm self-end"
          />

          {/* Notes */}
          <FormSection title="Notas">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Notas para el cliente" htmlFor="notes">
                <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Condiciones, aclaraciones…" />
              </FormField>
              <FormField label="Notas internas" htmlFor="internal_notes">
                <Textarea id="internal_notes" value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={3} placeholder="Visible solo para el equipo…" />
              </FormField>
            </div>
          </FormSection>
        </div>
      </PageBody>

      <CustomerQuickCreateDialog
        open={createContactOpen}
        onOpenChange={setCreateContactOpen}
        initialLegalName={createContactSeed}
        onCreated={(option) => {
          setContactOption(option)
          setContactId(option.value)
        }}
      />
    </div>
  )
}
