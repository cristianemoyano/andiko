'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
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
import { CustomerQuickCreateDialog } from '../../CustomerQuickCreateDialog'
import { cn, parseResponseBodyJson } from '@/lib/utils'

const PAYMENT_CONDITIONS = Object.entries(PAYMENT_CONDITION_LABEL).map(([value, label]) => ({
  value: value as PaymentCondition,
  label,
}))

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
      const res = await fetch(`/api/v1/contacts/${contactId}/addresses`)
      if (!res.ok) return
      const addresses = await res.json() as ContactAddress[]
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
      setServerError('Elegí una sucursal.')
      return
    }
    if (!contactId) {
      setSaving(false)
      setErrors(prev => ({ ...prev, contact_id: ['Seleccioná un cliente.'] }))
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

            <div className="grid grid-cols-2 gap-4">
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
              {actorName && (
                <FormField label="Vendedor">
                  <p className="text-[13px] text-zinc-700 py-1.5 px-3 bg-zinc-50 border border-zinc-200 rounded-sm">{actorName}</p>
                </FormField>
              )}
            </div>
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

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Dirección de entrega" htmlFor="shipping_address_id">
              <select
                id="shipping_address_id"
                value={shippingAddressId}
                onChange={(e) => {
                  const nextId = e.target.value
                  setShippingAddressId(nextId)
                  const selected = contactAddresses.find(a => a.id === nextId) ?? null
                  setShippingAddress(fromContactAddress(selected))
                }}
                className="h-8 w-full rounded-sm border border-zinc-300 bg-white px-2.5 text-[13px] text-zinc-900 focus:border-blue-500 focus:outline-none"
              >
                <option value="">Sin dirección predefinida</option>
                {contactAddresses
                  .filter(a => a.type === 'delivery')
                  .map((address) => (
                    <option key={address.id} value={address.id}>{addressLabel(address)}</option>
                  ))}
              </select>
            </FormField>
            <FormField label="Dirección de facturación" htmlFor="billing_address_id">
              <select
                id="billing_address_id"
                value={billingAddressId}
                onChange={(e) => {
                  const nextId = e.target.value
                  setBillingAddressId(nextId)
                  const selected = contactAddresses.find(a => a.id === nextId) ?? null
                  setBillingAddress(fromContactAddress(selected))
                }}
                className="h-8 w-full rounded-sm border border-zinc-300 bg-white px-2.5 text-[13px] text-zinc-900 focus:border-blue-500 focus:outline-none"
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

          <div className="grid grid-cols-2 gap-4">
            <AddressSnapshotFields
              prefix="shipping"
              title="Snapshot entrega"
              value={shippingAddress}
              onChange={setShippingAddress}
            />
            <AddressSnapshotFields
              prefix="billing"
              title="Snapshot facturación"
              value={billingAddress}
              onChange={setBillingAddress}
            />
          </div>
          </div>

          {serverError && (
            <p role="alert" className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2">
              {serverError}
            </p>
          )}
        </div>
      </div>

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
    <div className="rounded-sm border border-zinc-200 p-3">
      <p className="mb-3 text-[12px] font-medium text-zinc-600">{title}</p>
      <div className="grid grid-cols-2 gap-3">
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
