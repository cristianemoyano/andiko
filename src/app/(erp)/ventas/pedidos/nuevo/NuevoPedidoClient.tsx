'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody, FormSection } from '@/components/layout'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
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
type ContactAddress = {
  id: string
  type: 'fiscal' | 'delivery' | 'commercial'
  street: string
  number: string | null
  floor: string | null
  apartment: string | null
  city: string
  province: string
  postal_code: string | null
  country: string
  is_default: boolean
}

type AddressSnapshot = {
  street: string
  number: string
  floor: string
  apartment: string
  city: string
  province: string
  postal_code: string
  country: string
}

const EMPTY_ADDRESS: AddressSnapshot = {
  street: '',
  number: '',
  floor: '',
  apartment: '',
  city: '',
  province: '',
  postal_code: '',
  country: 'Argentina',
}

function fromContactAddress(address: ContactAddress | null): AddressSnapshot {
  if (!address) return { ...EMPTY_ADDRESS }
  return {
    street: address.street,
    number: address.number ?? '',
    floor: address.floor ?? '',
    apartment: address.apartment ?? '',
    city: address.city,
    province: address.province,
    postal_code: address.postal_code ?? '',
    country: address.country ?? 'Argentina',
  }
}

function addressLabel(address: ContactAddress): string {
  const base = [`${address.street}${address.number ? ` ${address.number}` : ''}`.trim(), address.city, address.province]
    .filter(Boolean)
    .join(', ')
  return `${address.type === 'fiscal' ? 'Fiscal' : address.type === 'delivery' ? 'Entrega' : 'Comercial'} — ${base}`
}

export function NuevoPedidoClient() {
  const router = useRouter()
  const { data: session } = useSession()
  const actorName = session?.user?.impersonation?.name ?? session?.user?.name ?? null

  const [contactId, setContactId]               = useState<string | null>(null)
  const [contactOption, setContactOption]       = useState<SearchableSelectOption | null>(null)
  const cfPrefillDoneRef = useRef(false)
  const [branchId, setBranchId]                 = useState<string | null>(null)
  const [priceListId, setPriceListId]           = useState<string | null>(null)
  const [promisedDate, setPromisedDate]         = useState<Date | null>(null)
  const [contactAddresses, setContactAddresses] = useState<ContactAddress[]>([])
  const [shippingAddressId, setShippingAddressId] = useState<string>('')
  const [billingAddressId, setBillingAddressId] = useState<string>('')
  const [shippingAddress, setShippingAddress] = useState<AddressSnapshot>({ ...EMPTY_ADDRESS })
  const [billingAddress, setBillingAddress] = useState<AddressSnapshot>({ ...EMPTY_ADDRESS })
  const [createContactOpen, setCreateContactOpen] = useState(false)
  const [createContactSeed, setCreateContactSeed] = useState('')
  const [paymentCondition, setPaymentCondition] = useState<PaymentCondition>('cash')
  const [items, setItems]                       = useState<LineItemInput[]>([makeEmptyLine()])
  const [branchStockMap, setBranchStockMap]     = useState<BranchStockMap>({})
  const [notes, setNotes]                       = useState('')
  const [internalNotes, setInternalNotes]       = useState('')
  const [saving, setSaving]                     = useState(false)
  const [errors, setErrors]                     = useState<FieldErrors>({})
  const [serverError, setServerError]           = useState<string | null>(null)

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
      return (data.data ?? []).map(c => ({ value: c.id, label: c.legal_name, sublabel: c.trade_name ?? undefined }))
    } catch {
      return []
    }
  }, [])

  useEffect(() => {
    if (cfPrefillDoneRef.current) return
    cfPrefillDoneRef.current = true
    let cancelled = false
    void (async () => {
      try {
        const data = await fetchJson<{ data: Array<{ id: string; legal_name: string; trade_name: string | null }> }>(
          '/api/v1/contacts?type=customer&system_key=consumidor_final&limit=1',
        )
        const cf = data.data?.[0]
        if (cancelled || !cf) return
        setContactId((current) => {
          if (current !== null) return current
          return cf.id
        })
        setContactOption((current) => {
          if (current) return current
          return { value: cf.id, label: cf.legal_name, sublabel: cf.trade_name ?? undefined }
        })
      } catch {
        // Prefill is best-effort; user can still pick a customer.
      }
    })()
    return () => { cancelled = true }
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

  useEffect(() => {
    if (!contactId) {
      queueMicrotask(() => {
        setContactAddresses([])
        setShippingAddressId('')
        setBillingAddressId('')
        setShippingAddress({ ...EMPTY_ADDRESS })
        setBillingAddress({ ...EMPTY_ADDRESS })
      })
      return
    }

    let cancelled = false
    void (async () => {
      let addresses: ContactAddress[] = []
      try {
        addresses = await fetchJson<ContactAddress[]>(`/api/v1/contacts/${contactId}/addresses`)
      } catch {
        return
      }
      if (cancelled) return

      const rows = Array.isArray(addresses) ? addresses : []
      setContactAddresses(rows)

      const defaultShipping = rows.find(a => a.type === 'delivery' && a.is_default)
        ?? rows.find(a => a.type === 'delivery')
        ?? null
      const defaultBilling = rows.find(a => a.type === 'fiscal' && a.is_default)
        ?? rows.find(a => a.type === 'fiscal')
        ?? null

      setShippingAddressId(defaultShipping?.id ?? '')
      setBillingAddressId(defaultBilling?.id ?? '')
      setShippingAddress(fromContactAddress(defaultShipping))
      setBillingAddress(fromContactAddress(defaultBilling))
    })()

    return () => { cancelled = true }
  }, [contactId])

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
      promised_date:     promisedDate ? promisedDate.toISOString() : null,
      shipping_street: shippingAddress.street || null,
      shipping_number: shippingAddress.number || null,
      shipping_floor: shippingAddress.floor || null,
      shipping_apartment: shippingAddress.apartment || null,
      shipping_city: shippingAddress.city || null,
      shipping_province: shippingAddress.province || null,
      shipping_postal_code: shippingAddress.postal_code || null,
      shipping_country: shippingAddress.country || null,
      billing_street: billingAddress.street || null,
      billing_number: billingAddress.number || null,
      billing_floor: billingAddress.floor || null,
      billing_apartment: billingAddress.apartment || null,
      billing_city: billingAddress.city || null,
      billing_province: billingAddress.province || null,
      billing_postal_code: billingAddress.postal_code || null,
      billing_country: billingAddress.country || null,
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
      const order = await fetchJson<{ id: string }>('/api/v1/sales/orders', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      router.push(`/ventas/pedidos/${order.id}`)
    } catch (err) {
      const fe = fieldErrorsFromApiError(err)
      if (fe) {
        setErrors(fe)
        notifyError('Revisá los campos marcados e intentá de nuevo.')
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

      <PageBody>
        <div className="max-w-4xl mx-auto flex flex-col gap-5">
          {/* Page header */}
          <div className="pt-1">
            <h1 className="text-xl font-semibold tracking-tight text-fg">Nuevo pedido</h1>
            <p className="mt-0.5 text-[13px] text-fg-muted">
              Elegí el cliente, cargá los ítems y confirmá el pedido para prepararlo.
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
              <FormField label="Fecha prometida" htmlFor="promised_date">
                <DatePicker id="promised_date" value={promisedDate} onChange={setPromisedDate} placeholder="Seleccionar fecha" />
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

          {/* Notes + addresses */}
          <FormSection title="Notas y direcciones">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Notas para el cliente" htmlFor="notes">
                <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Condiciones, aclaraciones…" />
              </FormField>
              <FormField label="Notas internas" htmlFor="internal_notes">
                <Textarea id="internal_notes" value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={3} placeholder="Visible solo para el equipo…" />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Dirección de entrega guardada" htmlFor="shipping_address_id">
                <select
                  id="shipping_address_id"
                  value={shippingAddressId}
                  onChange={(e) => {
                    const nextId = e.target.value
                    setShippingAddressId(nextId)
                    const selected = contactAddresses.find(a => a.id === nextId) ?? null
                    setShippingAddress(fromContactAddress(selected))
                  }}
                  className="h-9 w-full rounded-sm border border-border-strong bg-surface px-2.5 text-sm text-fg focus:border-ring focus:outline-none"
                >
                  <option value="">Sin dirección predefinida</option>
                  {contactAddresses
                    .filter(a => a.type === 'delivery')
                    .map((address) => (
                      <option key={address.id} value={address.id}>{addressLabel(address)}</option>
                    ))}
                </select>
              </FormField>
              <FormField label="Dirección de facturación guardada" htmlFor="billing_address_id">
                <select
                  id="billing_address_id"
                  value={billingAddressId}
                  onChange={(e) => {
                    const nextId = e.target.value
                    setBillingAddressId(nextId)
                    const selected = contactAddresses.find(a => a.id === nextId) ?? null
                    setBillingAddress(fromContactAddress(selected))
                  }}
                  className="h-9 w-full rounded-sm border border-border-strong bg-surface px-2.5 text-sm text-fg focus:border-ring focus:outline-none"
                >
                  <option value="">Sin dirección predefinida</option>
                  {contactAddresses
                    .filter(a => a.type === 'fiscal')
                    .map((address) => (
                      <option key={address.id} value={address.id}>{addressLabel(address)}</option>
                    ))}
                </select>
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AddressSnapshotFields
                prefix="shipping"
                title="Domicilio de entrega"
                value={shippingAddress}
                onChange={setShippingAddress}
              />
              <AddressSnapshotFields
                prefix="billing"
                title="Domicilio de facturación"
                value={billingAddress}
                onChange={setBillingAddress}
              />
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

function AddressSnapshotFields({
  prefix,
  title,
  value,
  onChange,
}: {
  prefix: string
  title: string
  value: AddressSnapshot
  onChange: (next: AddressSnapshot) => void
}) {
  function patch(p: Partial<AddressSnapshot>) {
    onChange({ ...value, ...p })
  }

  return (
    <div className="rounded-sm border border-border bg-surface-muted/40 p-3">
      <p className="mb-3 text-[13px] font-medium text-fg">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Calle" htmlFor={`${prefix}_street`}>
          <Input id={`${prefix}_street`} value={value.street} onChange={(e) => patch({ street: e.target.value })} />
        </FormField>
        <FormField label="Número" htmlFor={`${prefix}_number`}>
          <Input id={`${prefix}_number`} value={value.number} onChange={(e) => patch({ number: e.target.value })} />
        </FormField>
        <FormField label="Piso" htmlFor={`${prefix}_floor`}>
          <Input id={`${prefix}_floor`} value={value.floor} onChange={(e) => patch({ floor: e.target.value })} />
        </FormField>
        <FormField label="Depto" htmlFor={`${prefix}_apartment`}>
          <Input id={`${prefix}_apartment`} value={value.apartment} onChange={(e) => patch({ apartment: e.target.value })} />
        </FormField>
        <FormField label="Ciudad" htmlFor={`${prefix}_city`}>
          <Input id={`${prefix}_city`} value={value.city} onChange={(e) => patch({ city: e.target.value })} />
        </FormField>
        <FormField label="Provincia" htmlFor={`${prefix}_province`}>
          <Input id={`${prefix}_province`} value={value.province} onChange={(e) => patch({ province: e.target.value })} />
        </FormField>
        <FormField label="Código postal" htmlFor={`${prefix}_postal_code`}>
          <Input id={`${prefix}_postal_code`} value={value.postal_code} onChange={(e) => patch({ postal_code: e.target.value })} />
        </FormField>
        <FormField label="País" htmlFor={`${prefix}_country`}>
          <Input id={`${prefix}_country`} value={value.country} onChange={(e) => patch({ country: e.target.value })} />
        </FormField>
      </div>
    </div>
  )
}
