'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/primitives/Button'
import { SendDocumentEmail } from '@/components/erp/SendDocumentEmail'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { Textarea } from '@/components/primitives/Textarea'
import { DatePicker } from '@/components/primitives/DatePicker'
import { TotalsFooter } from '@/components/erp/TotalsFooter'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { EmptyState } from '@/components/erp/EmptyState'
import { StatusPipeline } from '@/components/erp/StatusPipeline'
import { SalesLineItemsEditor, calcTotals, makeEmptyLine } from '@/components/erp/SalesLineItemsEditor'
import type { LineItemInput } from '@/components/erp/SalesLineItemsEditor'
import { SearchableSelect } from '@/components/erp/SearchableSelect'
import type { SearchableSelectOption } from '@/components/erp/SearchableSelect'
import { VentasBranchField } from '@/components/erp/VentasBranchField'
import { formatARS } from '@/components/primitives/CurrencyInput'
import type { Order, PaymentCondition } from '../../types'
import { INVOICE_STATUS_LABEL, PAYMENT_CONDITION_LABEL } from '../../types'
import { VentasSubNav } from '../../VentasSubNav'
import { CustomerQuickCreateDialog } from '../../CustomerQuickCreateDialog'
import { cn } from '@/lib/utils'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifyApiError } from '@/lib/notify'
import { fieldErrorsFromApiError } from '@/lib/validation-errors'

const PAYMENT_CONDITIONS = Object.entries(PAYMENT_CONDITION_LABEL).map(([value, label]) => ({
  value: value as PaymentCondition,
  label,
}))

type OrderStatus = Order['status']
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

function orderSnapshot(prefix: 'shipping' | 'billing', order: Order): AddressSnapshot {
  return {
    street: (prefix === 'shipping' ? order.shipping_street : order.billing_street) ?? '',
    number: (prefix === 'shipping' ? order.shipping_number : order.billing_number) ?? '',
    floor: (prefix === 'shipping' ? order.shipping_floor : order.billing_floor) ?? '',
    apartment: (prefix === 'shipping' ? order.shipping_apartment : order.billing_apartment) ?? '',
    city: (prefix === 'shipping' ? order.shipping_city : order.billing_city) ?? '',
    province: (prefix === 'shipping' ? order.shipping_province : order.billing_province) ?? '',
    postal_code: (prefix === 'shipping' ? order.shipping_postal_code : order.billing_postal_code) ?? '',
    country: (prefix === 'shipping' ? order.shipping_country : order.billing_country) ?? 'Argentina',
  }
}

function displaySnapshot(address: AddressSnapshot): string | null {
  const first = `${address.street}${address.number ? ` ${address.number}` : ''}`.trim()
  const parts = [first, address.city, address.province, address.postal_code, address.country].filter(Boolean)
  if (parts.length === 0) return null
  return parts.join(', ')
}

const STATUS_TRANSITIONS: Partial<Record<OrderStatus, { next: OrderStatus; label: string }[]>> = {
  draft:       [{ next: 'confirmed',   label: 'Confirmar pedido' }],
  confirmed:   [{ next: 'in_progress', label: 'Iniciar proceso' }],
  in_progress: [{ next: 'delivered',   label: 'Marcar entregado' }],
}
const CAN_CANCEL: OrderStatus[] = ['draft', 'confirmed', 'in_progress']

function itemsToLineInput(items: Order['items']): LineItemInput[] {
  if (!items || items.length === 0) return [makeEmptyLine()]
  return items.map((item, idx) => ({
    id:           item.id ?? String(idx),
    product_id:   item.product_id ?? null,
    variant_id:   item.variant_id ?? null,
    description:  item.description,
    quantity:     item.quantity,
    unit_price:   item.unit_price,
    discount_pct: item.discount_pct,
    iva_rate:     item.iva_rate,
  }))
}

interface OrderDetailProps {
  id: string
}

export function OrderDetail({ id }: OrderDetailProps) {
  const router = useRouter()
  const [order, setOrder]     = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [relatedInvoices, setRelatedInvoices] = useState<Array<{
    id: string
    invoice_number: string
    status: keyof typeof INVOICE_STATUS_LABEL
    issue_date: string | null
    created_at: string
  }>>([])
  const [loadingTraceability, setLoadingTraceability] = useState(false)

  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [errors, setErrors]     = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)

  // Edit form fields
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

  // Confirm dialogs
  const [confirmConvert, setConfirmConvert]   = useState(false)
  const [confirmCancel, setConfirmCancel]     = useState(false)
  const [transitioning, setTransitioning]     = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const data = await fetchJson<Order>(`/api/v1/sales/orders/${id}`)
        if (!cancelled) setOrder(data)
      } catch {
        if (!cancelled) setOrder(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id, refresh])

  useEffect(() => {
    let cancelled = false
    async function loadRelatedInvoices() {
      setLoadingTraceability(true)
      const params = new URLSearchParams({
        order_id: id,
        page: '1',
        limit: '50',
      })
      try {
        const payload = await fetchJson<{
          data?: Array<{
            id: string
            invoice_number: string
            status: keyof typeof INVOICE_STATUS_LABEL
            issue_date: string | null
            created_at: string
          }>
        }>(`/api/v1/sales/invoices?${params}`)
        if (cancelled) return
        setRelatedInvoices(Array.isArray(payload.data) ? payload.data : [])
      } catch {
        if (!cancelled) setRelatedInvoices([])
      } finally {
        if (!cancelled) setLoadingTraceability(false)
      }
    }

    void loadRelatedInvoices()
    return () => { cancelled = true }
  }, [id, refresh])

  function enterEditMode(o: Order) {
    setContactId(o.contact_id ?? null)
    if (o.contact_id && o.contact) {
      setContactOption({
        value: o.contact_id,
        label: o.contact.legal_name,
        sublabel: o.contact.trade_name ?? undefined,
      })
    } else {
      setContactOption(null)
    }
    setBranchId(o.branch_id ?? null)
    setPriceListId(o.price_list_id ?? null)
    setPromisedDate(o.promised_date ? new Date(o.promised_date) : null)
    setShippingAddress(orderSnapshot('shipping', o))
    setBillingAddress(orderSnapshot('billing', o))
    setShippingAddressId('')
    setBillingAddressId('')
    setPaymentCondition(o.payment_condition)
    setItems(itemsToLineInput(o.items))
    setNotes(o.notes ?? '')
    setInternalNotes(o.internal_notes ?? '')
    setErrors({})
    setServerError(null)
    setEditMode(true)
  }

  function cancelEdit() {
    setEditMode(false)
    setErrors({})
    setServerError(null)
  }

  async function handleSave() {
    if (!order) return
    setSaving(true)
    setErrors({})
    setServerError(null)

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

    try {
      await fetchJson(`/api/v1/sales/orders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      setEditMode(false)
      setRefresh(r => r + 1)
    } catch (err) {
      const fe = fieldErrorsFromApiError(err)
      if (fe) setErrors(fe)
      else setServerError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleTransition(nextStatus: OrderStatus) {
    setTransitioning(true)
    try {
      await fetchJson(`/api/v1/sales/orders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      })
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    } finally {
      setTransitioning(false)
    }
  }

  async function handleCancelOrder() {
    setTransitioning(true)
    setConfirmCancel(false)
    try {
      await fetchJson(`/api/v1/sales/orders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' }),
      })
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    } finally {
      setTransitioning(false)
    }
  }

  async function handleConvertToInvoice() {
    setConfirmConvert(false)
    try {
      const invoice = await fetchJson<{ id: string }>(`/api/v1/sales/orders/${id}/convert`, { method: 'POST' })
      router.push(`/ventas/facturas/${invoice.id}`)
    } catch (e) {
      notifyApiError(e)
    }
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

  useEffect(() => {
    if (!editMode || !contactId) return
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
      if (!shippingAddress.street && !shippingAddress.city) {
        const nextShipping = rows.find(a => a.type === 'delivery' && a.is_default) ?? rows.find(a => a.type === 'delivery') ?? null
        if (nextShipping) {
          setShippingAddressId(nextShipping.id)
          setShippingAddress(fromContactAddress(nextShipping))
        }
      }
      if (!billingAddress.street && !billingAddress.city) {
        const nextBilling = rows.find(a => a.type === 'fiscal' && a.is_default) ?? rows.find(a => a.type === 'fiscal') ?? null
        if (nextBilling) {
          setBillingAddressId(nextBilling.id)
          setBillingAddress(fromContactAddress(nextBilling))
        }
      }
    })()
    return () => { cancelled = true }
  }, [editMode, contactId, shippingAddress.street, shippingAddress.city, billingAddress.street, billingAddress.city])

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Ventas', href: '/ventas/presupuestos' }, { label: 'Pedidos', href: '/ventas/pedidos' }, { label: '…' }]} />
        <VentasSubNav />
        <div className="flex-1 flex items-center justify-center text-[13px] text-zinc-400">Cargando…</div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Ventas', href: '/ventas/presupuestos' }, { label: 'Pedidos', href: '/ventas/pedidos' }, { label: 'No encontrado' }]} />
        <VentasSubNav />
        <div className="flex-1 flex items-center justify-center">
          <EmptyState title="Pedido no encontrado" description="El pedido no existe o fue eliminado." />
        </div>
      </div>
    )
  }

  const transitions = STATUS_TRANSITIONS[order.status] ?? []
  const canCancel   = CAN_CANCEL.includes(order.status)
  const canConvert  = order.status === 'delivered'
  const canEdit     = order.status !== 'delivered' && order.status !== 'cancelled'
  const canDeliver  = order.status === 'confirmed' || order.status === 'in_progress' || order.status === 'delivered'

  const editTotals = editMode ? calcTotals(items) : null

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Ventas', href: '/ventas/presupuestos' },
          { label: 'Pedidos', href: '/ventas/pedidos' },
          { label: order.order_number },
        ]}
        actions={
          <div className="flex flex-wrap gap-2 justify-end">
            <Button asChild size="sm" variant="ghost">
              <Link href={`/ventas/pedidos/${id}/print`} target="_blank" rel="noopener noreferrer">
                Imprimir
              </Link>
            </Button>
            <SendDocumentEmail
              documentType="order"
              documentId={id}
              documentLabel={`Pedido ${order.order_number}`}
            />
            {!editMode && (
              <>
                {transitions.map(t => (
                  <Button key={t.next} size="sm" variant="secondary" onClick={() => handleTransition(t.next)} disabled={transitioning}>
                    {t.label}
                  </Button>
                ))}
                {canDeliver && (
                  <Button size="sm" variant="secondary" onClick={() => router.push(`/inventario/remitos/nuevo?order_id=${order.id}`)}>
                    Crear remito
                  </Button>
                )}
                {canConvert && (
                  <Button size="sm" onClick={() => setConfirmConvert(true)} disabled={transitioning}>
                    Crear factura
                  </Button>
                )}
                {canCancel && (
                  <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(true)} disabled={transitioning}>
                    Cancelar pedido
                  </Button>
                )}
                {canEdit && (
                  <Button size="sm" variant="secondary" onClick={() => enterEditMode(order)}>
                    Editar
                  </Button>
                )}
              </>
            )}
            {editMode && (
              <>
                <Button size="sm" variant="secondary" onClick={cancelEdit} disabled={saving}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </Button>
              </>
            )}
          </div>
        }
      />
      <VentasSubNav />

      <div className="flex-1 p-5 overflow-auto">
        <div className="max-w-4xl mx-auto flex flex-col gap-5">

          {/* Status pipeline */}
          <div className="bg-white border border-zinc-200 rounded-sm px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wide mb-1">Pedido</p>
              <h1 className="text-[20px] font-bold text-zinc-900 tracking-tight">{order.order_number}</h1>
            </div>
            <StatusPipeline type="order" status={order.status} />
          </div>

          {/* Header info card */}
          <div className="bg-white border border-zinc-200 rounded-sm p-5 flex flex-col gap-4">
            {editMode ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Cliente" htmlFor="contact_id" error={errors.contact_id?.[0]}>
                    <SearchableSelect
                      id="contact_id"
                      value={contactId}
                      onChange={(next) => {
                        setContactId(next)
                        setShippingAddress({ ...EMPTY_ADDRESS })
                        setBillingAddress({ ...EMPTY_ADDRESS })
                        setShippingAddressId('')
                        setBillingAddressId('')
                        if (!next) setContactOption(null)
                      }}
                      onSelect={setContactOption}
                      onSearch={searchContacts}
                      options={contactOption ? [contactOption] : []}
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
                      {contactAddresses.filter(a => a.type === 'delivery').map((address) => (
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
                      {contactAddresses.filter(a => a.type === 'fiscal').map((address) => (
                        <option key={address.id} value={address.id}>{addressLabel(address)}</option>
                      ))}
                    </select>
                  </FormField>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <AddressSnapshotFields prefix="shipping" title="Snapshot entrega" value={shippingAddress} onChange={setShippingAddress} />
                  <AddressSnapshotFields prefix="billing" title="Snapshot facturación" value={billingAddress} onChange={setBillingAddress} />
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px]">
                <div>
                  <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Sucursal</p>
                  <p className="text-zinc-800">
                    {order.branch
                      ? `${String(order.branch.branch_code).padStart(2, '0')} — ${order.branch.name}`
                      : <span className="text-zinc-400">—</span>}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Cliente</p>
                  <p className="text-zinc-800 font-medium">{order.contact?.legal_name ?? <span className="text-zinc-400">—</span>}</p>
                  {order.contact?.trade_name && (
                    <p className="text-[12px] text-zinc-500">{order.contact.trade_name}</p>
                  )}
                </div>
                <div>
                  <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Condición de pago</p>
                  <p className="text-zinc-800">{PAYMENT_CONDITION_LABEL[order.payment_condition]}</p>
                </div>
                <div>
                  <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Fecha prometida</p>
                  <p className="text-zinc-800">
                    {order.promised_date
                      ? new Date(order.promised_date).toLocaleDateString('es-AR')
                      : <span className="text-zinc-400">—</span>
                    }
                  </p>
                </div>
                {order.salesperson && (
                  <div>
                    <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Vendedor</p>
                    <p className="text-zinc-800">{order.salesperson.name}</p>
                  </div>
                )}
              </div>
            )}

            {!editMode && (
              <div className="grid grid-cols-2 gap-4 border-t border-zinc-100 pt-4 text-[13px]">
                <div>
                  <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">Dirección de entrega</p>
                  <p className="text-zinc-700">{displaySnapshot(orderSnapshot('shipping', order)) ?? <span className="text-zinc-400">—</span>}</p>
                </div>
                <div>
                  <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">Dirección de facturación</p>
                  <p className="text-zinc-700">{displaySnapshot(orderSnapshot('billing', order)) ?? <span className="text-zinc-400">—</span>}</p>
                </div>
              </div>
            )}

            {/* Notes — always visible */}
            {editMode ? (
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-100">
                <FormField label="Notas para el cliente" htmlFor="notes">
                  <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Condiciones, aclaraciones…" />
                </FormField>
                <FormField label="Notas internas" htmlFor="internal_notes">
                  <Textarea id="internal_notes" value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={3} placeholder="Visible solo para el equipo…" />
                </FormField>
              </div>
            ) : (
              (order.notes || order.internal_notes) && (
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-100">
                  {order.notes && (
                    <div>
                      <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Notas</p>
                      <p className="text-[13px] text-zinc-600 whitespace-pre-line">{order.notes}</p>
                    </div>
                  )}
                  {order.internal_notes && (
                    <div>
                      <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Notas internas</p>
                      <p className="text-[13px] text-zinc-600 whitespace-pre-line">{order.internal_notes}</p>
                    </div>
                  )}
                </div>
              )
            )}

            {serverError && (
              <p role="alert" className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2">
                {serverError}
              </p>
            )}
          </div>

          <div className="bg-white border border-zinc-200 rounded-sm p-5">
            <h2 className="text-[13px] font-semibold text-zinc-900 mb-3">Trazabilidad</h2>
            <div className="space-y-3">
              <div>
                <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-1">Origen</p>
                {order.quote_id ? (
                  <Button variant="ghost" size="xs" asChild>
                    <Link href={`/ventas/presupuestos/${order.quote_id}`}>Ver presupuesto origen</Link>
                  </Button>
                ) : (
                  <p className="text-[13px] text-zinc-500">Pedido creado manualmente (sin presupuesto origen).</p>
                )}
              </div>
              <div>
                <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-1">Destino</p>
                {loadingTraceability ? (
                  <p className="text-[13px] text-zinc-500">Cargando facturas relacionadas…</p>
                ) : relatedInvoices.length === 0 ? (
                  <p className="text-[13px] text-zinc-500">Todavía no hay facturas generadas desde este pedido.</p>
                ) : (
                  <div className="space-y-2">
                    {relatedInvoices.map((invoice) => (
                      <div key={invoice.id} className="flex items-center justify-between gap-3 rounded-sm border border-zinc-200 px-3 py-2">
                        <div>
                          <p className="text-[13px] font-medium text-zinc-900">{invoice.invoice_number}</p>
                          <p className="text-[12px] text-zinc-500">
                            {INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status} · {new Date(invoice.issue_date ?? invoice.created_at).toLocaleDateString('es-AR')}
                          </p>
                        </div>
                        <Button variant="ghost" size="xs" asChild>
                          <Link href={`/ventas/facturas/${invoice.id}`}>Ver factura</Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Items */}
          {editMode ? (
            <div className="bg-white border border-zinc-200 rounded-sm p-5">
              <SalesLineItemsEditor items={items} onChange={setItems} priceListId={priceListId} />
            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-100">
                <h2 className="text-[13px] font-semibold text-zinc-900">Ítems</h2>
              </div>
              {order.items && order.items.length > 0 ? (
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-100">
                      <th className="px-4 py-2 text-left font-medium text-zinc-500">Descripción</th>
                      <th className="px-4 py-2 text-right font-medium text-zinc-500">Cant.</th>
                      <th className="px-4 py-2 text-right font-medium text-zinc-500">P. unitario</th>
                      <th className="px-4 py-2 text-right font-medium text-zinc-500">Desc.</th>
                      <th className="px-4 py-2 text-right font-medium text-zinc-500">IVA</th>
                      <th className="px-4 py-2 text-right font-medium text-zinc-500">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map(item => (
                      <tr key={item.id} className="border-b border-zinc-100 last:border-0">
                        <td className="px-4 py-2.5 text-zinc-800">{item.description}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-zinc-600">{item.quantity}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-zinc-600">{formatARS(item.unit_price)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">
                          {parseFloat(item.discount_pct) > 0 ? `${item.discount_pct}%` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">{item.iva_rate}%</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium text-zinc-800">{formatARS(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="px-4 py-8 text-center text-[13px] text-zinc-400">Sin ítems</div>
              )}
            </div>
          )}

          {/* Totals */}
          {editMode && editTotals ? (
            <TotalsFooter
              subtotal={String(editTotals.subtotal)}
              discountAmount={String(editTotals.discountAmount)}
              taxBreakdown={editTotals.taxBreakdown}
              taxAmount={String(editTotals.taxAmount)}
              total={String(editTotals.total)}
              className="max-w-xs self-end"
            />
          ) : (
            <TotalsFooter
              subtotal={order.subtotal}
              discountAmount={order.discount_amount}
              taxAmount={order.tax_amount}
              total={order.total}
              className="max-w-xs self-end"
            />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmConvert}
        onOpenChange={setConfirmConvert}
        title="Crear factura"
        description={`Se creará una factura a partir del pedido ${order.order_number}. El pedido debe estar entregado.`}
        confirmLabel="Crear factura"
        variant="warning"
        onConfirm={handleConvertToInvoice}
      />

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancelar pedido"
        description={`¿Cancelar el pedido ${order.order_number}? Esta acción no se puede deshacer.`}
        confirmLabel="Cancelar pedido"
        variant="danger"
        onConfirm={handleCancelOrder}
      />

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
