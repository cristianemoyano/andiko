'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { EmptyState } from '@/components/erp/EmptyState'
import { PageActionBar, type PageAction } from '@/components/erp/PageActionBar'
import { ShipmentStatusBadge } from '@/components/erp'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Textarea } from '@/components/primitives/Textarea'
import { CurrencyInput, formatARS } from '@/components/primitives/CurrencyInput'
import { DatePicker } from '@/components/primitives/DatePicker'
import {
  FULFILLMENT_KIND_LABEL,
  SHIPMENT_STATUS_LABEL,
  canEditShipment,
  canTransitionShipment,
} from '@/modules/logistics/logistics.constants'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifyApiError, notifySuccess } from '@/lib/notify'
import { LogisticaSubNav } from '../../LogisticaSubNav'
import type { ShipmentDetailData, DriverOption, VehicleOption } from '../../types'
import type { Order } from '@/app/(erp)/ventas/types'
import { DispatchDialog } from './DispatchDialog'
import { EventDialog } from './EventDialog'
import { NonShippableLineBadge } from '@/components/erp/NonShippableLineBadge'
import type { ProductType } from '@/modules/catalog/product.model'

const EVENT_SOURCE_LABEL: Record<string, string> = {
  system:  'Sistema',
  manual:  'Manual',
  webhook: 'Webhook',
  poll:    'Consulta automática',
}

function formatAddress(s: ShipmentDetailData): string | null {
  const first = `${s.ship_street ?? ''}${s.ship_number ? ` ${s.ship_number}` : ''}`.trim()
  const floorApt = [s.ship_floor, s.ship_apartment].filter(Boolean).join(' ')
  const parts = [first, floorApt, s.ship_city, s.ship_province, s.ship_postal_code, s.ship_country].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
}

function toDateInput(value: string | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

type ShipmentEditLine = {
  sales_order_item_id: string
  description: string
  remaining: number
  quantity: string
}

function buildShipmentEditLines(shipment: ShipmentDetailData, order: Order): ShipmentEditLine[] {
  const inShipment = new Map(
    (shipment.items ?? []).map(item => [item.sales_order_item_id, parseFloat(item.quantity) || 0]),
  )

  return (order.items ?? [])
    .filter(orderItem => orderItem.product_type !== 'service')
    .map(orderItem => {
      const currentQty = inShipment.get(orderItem.id) ?? 0
      const orderQty = parseFloat(orderItem.quantity) || 0
      const shipped = parseFloat(orderItem.shipped_qty ?? '0') || 0
      const remaining = orderQty - shipped + currentQty
      return {
        sales_order_item_id: orderItem.id,
        description: orderItem.description,
        remaining,
        quantity: currentQty > 0 ? String(currentQty) : '0',
      }
    })
    .filter(line => line.remaining > 0 || (parseFloat(line.quantity) || 0) > 0)
}

function fallbackShipmentEditLines(shipment: ShipmentDetailData): ShipmentEditLine[] {
  return (shipment.items ?? []).map(item => {
    const qty = parseFloat(item.quantity) || 0
    return {
      sales_order_item_id: item.sales_order_item_id,
      description: item.description,
      remaining: qty,
      quantity: item.quantity,
    }
  })
}

export function ShipmentDetail({ id }: { id: string }) {
  const [shipment, setShipment] = useState<ShipmentDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)

  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const [shipToName, setShipToName] = useState('')
  const [shipToPhone, setShipToPhone] = useState('')
  const [shipStreet, setShipStreet] = useState('')
  const [shipNumber, setShipNumber] = useState('')
  const [shipFloor, setShipFloor] = useState('')
  const [shipApartment, setShipApartment] = useState('')
  const [shipCity, setShipCity] = useState('')
  const [shipProvince, setShipProvince] = useState('')
  const [shipPostalCode, setShipPostalCode] = useState('')
  const [shipCountry, setShipCountry] = useState('Argentina')
  const [promisedDate, setPromisedDate] = useState<Date | null>(null)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [shippingCost, setShippingCost] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [driverId, setDriverId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [drivers, setDrivers] = useState<DriverOption[]>([])
  const [vehicles, setVehicles] = useState<VehicleOption[]>([])
  const [itemLines, setItemLines] = useState<ShipmentEditLine[]>([])
  const [itemError, setItemError] = useState<string | null>(null)
  const [orderItemTypes, setOrderItemTypes] = useState<Map<string, ProductType | null>>(new Map())

  const [dispatchOpen, setDispatchOpen] = useState(false)
  const [eventOpen, setEventOpen] = useState(false)
  const [confirmDeliver, setConfirmDeliver] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [transitioning, setTransitioning] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const data = await fetchJson<ShipmentDetailData>(`/api/v1/logistics/shipments/${id}`)
        if (!cancelled) setShipment(data)
      } catch {
        if (!cancelled) setShipment(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id, refresh])

  useEffect(() => {
    if (!shipment?.sales_order_id) {
      queueMicrotask(() => setOrderItemTypes(new Map()))
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const order = await fetchJson<Order>(`/api/v1/sales/orders/${shipment.sales_order_id}`)
        if (cancelled) return
        setOrderItemTypes(new Map(
          (order.items ?? []).map(item => [item.id, item.product_type ?? null]),
        ))
      } catch {
        if (!cancelled) setOrderItemTypes(new Map())
      }
    })()
    return () => { cancelled = true }
  }, [shipment?.sales_order_id, refresh])

  useEffect(() => {
    if (!editMode || !shipment || shipment.provider_kind !== 'in_house') return
    let cancelled = false
    void (async () => {
      try {
        const [driversRes, vehiclesRes] = await Promise.all([
          fetchJson<{ data: DriverOption[] }>('/api/v1/logistics/drivers'),
          fetchJson<{ data: VehicleOption[] }>('/api/v1/logistics/vehicles?is_active=true&limit=100'),
        ])
        if (!cancelled) {
          setDrivers(driversRes.data ?? [])
          setVehicles(vehiclesRes.data ?? [])
        }
      } catch {
        if (!cancelled) {
          setDrivers([])
          setVehicles([])
        }
      }
    })()
    return () => { cancelled = true }
  }, [editMode, shipment])

  async function enterEditMode(s: ShipmentDetailData) {
    setShipToName(s.ship_to_name ?? '')
    setShipToPhone(s.ship_to_phone ?? '')
    setShipStreet(s.ship_street ?? '')
    setShipNumber(s.ship_number ?? '')
    setShipFloor(s.ship_floor ?? '')
    setShipApartment(s.ship_apartment ?? '')
    setShipCity(s.ship_city ?? '')
    setShipProvince(s.ship_province ?? '')
    setShipPostalCode(s.ship_postal_code ?? '')
    setShipCountry(s.ship_country ?? 'Argentina')
    setPromisedDate(toDateInput(s.promised_date))
    setTrackingNumber(s.tracking_number ?? '')
    setShippingCost(s.shipping_cost ?? '0')
    setDeliveryNotes(s.delivery_notes ?? '')
    setDriverId(s.assigned_driver_id ?? '')
    setVehicleId(s.vehicle_id ?? '')
    setServerError(null)
    setItemError(null)

    if (s.sales_order_id) {
      try {
        const order = await fetchJson<Order>(`/api/v1/sales/orders/${s.sales_order_id}`)
        setItemLines(buildShipmentEditLines(s, order))
      } catch {
        setItemLines(fallbackShipmentEditLines(s))
      }
    } else {
      setItemLines(fallbackShipmentEditLines(s))
    }

    setEditMode(true)
  }

  function cancelEdit() {
    setEditMode(false)
    setServerError(null)
    setItemError(null)
    setItemLines([])
  }

  function setLineQuantity(salesOrderItemId: string, quantity: string) {
    setItemLines(prev => prev.map(line =>
      line.sales_order_item_id === salesOrderItemId ? { ...line, quantity } : line,
    ))
    setItemError(null)
  }

  async function handleSave() {
    if (!shipment) return

    const invalidLine = itemLines.find(line => {
      const qty = parseFloat(line.quantity)
      return Number.isNaN(qty) || qty < 0 || qty > line.remaining
    })
    const selectedLines = itemLines.filter(line => (parseFloat(line.quantity) || 0) > 0)
    if (selectedLines.length === 0) {
      setItemError('Seleccioná al menos un ítem con cantidad mayor a cero.')
      return
    }
    if (invalidLine) {
      setItemError(`La cantidad de «${invalidLine.description}» debe estar entre 0 y ${invalidLine.remaining}.`)
      return
    }

    setSaving(true)
    setServerError(null)
    setItemError(null)
    const isInHouse = shipment.provider_kind === 'in_house'
    try {
      await fetchJson(`/api/v1/logistics/shipments/${shipment.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ship_to_name:     shipToName.trim() || null,
          ship_to_phone:    shipToPhone.trim() || null,
          ship_street:      shipStreet.trim() || null,
          ship_number:      shipNumber.trim() || null,
          ship_floor:       shipFloor.trim() || null,
          ship_apartment:   shipApartment.trim() || null,
          ship_city:        shipCity.trim() || null,
          ship_province:    shipProvince.trim() || null,
          ship_postal_code: shipPostalCode.trim() || null,
          ship_country:     shipCountry.trim() || null,
          promised_date:    promisedDate ? promisedDate.toISOString().slice(0, 10) : null,
          delivery_notes:   deliveryNotes.trim() || null,
          shipping_cost:    parseFloat(shippingCost) || 0,
          items: itemLines.map(line => ({
            sales_order_item_id: line.sales_order_item_id,
            quantity: parseFloat(line.quantity) || 0,
          })),
          ...(!isInHouse ? { tracking_number: trackingNumber.trim() || null } : {}),
          ...(isInHouse ? {
            assigned_driver_id: driverId || null,
            vehicle_id: vehicleId || null,
            ...(trackingNumber.trim() ? { tracking_number: trackingNumber.trim() } : {}),
          } : {}),
        }),
      })
      notifySuccess(`Envío ${shipment.shipment_number} actualizado`)
      setEditMode(false)
      setItemLines([])
      setRefresh(r => r + 1)
    } catch (e) {
      setServerError(getApiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeliver() {
    setConfirmDeliver(false)
    setTransitioning(true)
    try {
      await fetchJson(`/api/v1/logistics/shipments/${id}/events`, {
        method: 'POST',
        body: JSON.stringify({ status: 'delivered', description: 'Entregado' }),
      })
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    } finally {
      setTransitioning(false)
    }
  }

  async function handleCancel() {
    setConfirmCancel(false)
    setTransitioning(true)
    try {
      await fetchJson(`/api/v1/logistics/shipments/${id}/cancel`, { method: 'POST' })
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    } finally {
      setTransitioning(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Logística', href: '/logistica/envios' }, { label: 'Envíos', href: '/logistica/envios' }, { label: '…' }]} />
        <LogisticaSubNav />
        <div className="flex-1 flex items-center justify-center text-[13px] text-fg-subtle">Cargando…</div>
      </div>
    )
  }

  if (!shipment) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Logística', href: '/logistica/envios' }, { label: 'Envíos', href: '/logistica/envios' }, { label: 'No encontrado' }]} />
        <LogisticaSubNav />
        <div className="flex-1 flex items-center justify-center">
          <EmptyState title="Envío no encontrado" description="El envío no existe o fue eliminado." />
        </div>
      </div>
    )
  }

  const isInHouse = shipment.provider_kind === 'in_house'
  const canDispatch = canTransitionShipment(shipment.status, 'dispatched')
  const canDeliver  = canTransitionShipment(shipment.status, 'delivered')
  const canCancel   = canTransitionShipment(shipment.status, 'cancelled')
  const canEdit     = canEditShipment(shipment.status)
  const hasNextEvent = !canDispatch &&
    Object.keys(SHIPMENT_STATUS_LABEL).some(s =>
      s !== 'cancelled' && canTransitionShipment(shipment.status, s as ShipmentDetailData['status']),
    )
  const address = formatAddress(shipment)
  const events = shipment.events ?? []
  const items = shipment.items ?? []

  const primaryAction: PageAction | null = editMode
    ? null
    : canDispatch
      ? { id: 'dispatch', label: 'Despachar', onClick: () => setDispatchOpen(true), disabled: transitioning }
      : canDeliver
        ? { id: 'deliver', label: 'Marcar entregado', onClick: () => setConfirmDeliver(true), disabled: transitioning }
        : canEdit
          ? { id: 'edit', label: 'Editar', onClick: () => enterEditMode(shipment) }
          : null

  const secondaryActions: PageAction[] = editMode
    ? []
    : [
        ...(canEdit && primaryAction?.id !== 'edit'
          ? [{ id: 'edit', label: 'Editar', onClick: () => enterEditMode(shipment), disabled: transitioning }]
          : []),
        ...(hasNextEvent ? [{ id: 'event', label: 'Registrar evento', onClick: () => setEventOpen(true), disabled: transitioning }] : []),
        ...(canCancel ? [{ id: 'cancel', label: 'Cancelar envío', onClick: () => setConfirmCancel(true), disabled: transitioning, variant: 'destructive' as const }] : []),
      ]

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Logística', href: '/logistica/envios' },
          { label: 'Envíos', href: '/logistica/envios' },
          { label: shipment.shipment_number },
        ]}
        actions={
          <PageActionBar
            edit={editMode ? {
              onCancel: cancelEdit,
              onSave: handleSave,
              saving,
            } : undefined}
            primary={primaryAction}
            secondary={secondaryActions}
          />
        }
      />
      <LogisticaSubNav />

      <PageBody>
        <div className="max-w-4xl mx-auto flex flex-col gap-5">

          {/* Header */}
          <div className="bg-surface border border-border rounded-sm px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide mb-1">Envío</p>
              <h1 className="text-[20px] font-bold text-fg tracking-tight">{shipment.shipment_number}</h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-fg-muted">
                {shipment.carrierAccount?.name ?? FULFILLMENT_KIND_LABEL[shipment.provider_kind]}
              </span>
              <ShipmentStatusBadge status={shipment.status} />
            </div>
          </div>

          {shipment.status === 'failed' && shipment.failure_reason && !editMode && (
            <div role="status" className="rounded-sm border border-danger bg-danger-bg px-4 py-3 text-[13px] text-danger">
              Último intento de entrega fallido: {shipment.failure_reason}
            </div>
          )}

          {/* Info / edit form */}
          <div className="bg-surface border border-border rounded-sm p-5">
            {editMode ? (
              <div className="flex flex-col gap-5">
                {serverError && (
                  <div role="alert" className="rounded-sm border border-danger bg-danger-bg px-4 py-3 text-[13px] text-danger">
                    {serverError}
                  </div>
                )}

                <div>
                  <p className="text-[11px] font-semibold text-fg-muted uppercase tracking-wide mb-3">Destino</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label="Destinatario" htmlFor="ship_to_name">
                      <Input id="ship_to_name" value={shipToName} onChange={e => setShipToName(e.target.value)} />
                    </FormField>
                    <FormField label="Teléfono" htmlFor="ship_to_phone">
                      <Input id="ship_to_phone" value={shipToPhone} onChange={e => setShipToPhone(e.target.value)} />
                    </FormField>
                    <FormField label="Calle" htmlFor="ship_street" className="sm:col-span-2">
                      <Input id="ship_street" value={shipStreet} onChange={e => setShipStreet(e.target.value)} />
                    </FormField>
                    <FormField label="Número" htmlFor="ship_number">
                      <Input id="ship_number" value={shipNumber} onChange={e => setShipNumber(e.target.value)} />
                    </FormField>
                    <FormField label="Piso" htmlFor="ship_floor">
                      <Input id="ship_floor" value={shipFloor} onChange={e => setShipFloor(e.target.value)} />
                    </FormField>
                    <FormField label="Depto" htmlFor="ship_apartment">
                      <Input id="ship_apartment" value={shipApartment} onChange={e => setShipApartment(e.target.value)} />
                    </FormField>
                    <FormField label="Ciudad" htmlFor="ship_city">
                      <Input id="ship_city" value={shipCity} onChange={e => setShipCity(e.target.value)} />
                    </FormField>
                    <FormField label="Provincia" htmlFor="ship_province">
                      <Input id="ship_province" value={shipProvince} onChange={e => setShipProvince(e.target.value)} />
                    </FormField>
                    <FormField label="CP" htmlFor="ship_postal_code">
                      <Input id="ship_postal_code" value={shipPostalCode} onChange={e => setShipPostalCode(e.target.value)} />
                    </FormField>
                    <FormField label="País" htmlFor="ship_country">
                      <Input id="ship_country" value={shipCountry} onChange={e => setShipCountry(e.target.value)} />
                    </FormField>
                  </div>
                </div>

                <div className="border-t border-border pt-5">
                  <p className="text-[11px] font-semibold text-fg-muted uppercase tracking-wide mb-3">Logística</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label="Pedido">
                      {shipment.salesOrder ? (
                        <Link href={`/ventas/pedidos/${shipment.salesOrder.id}`} className="text-[13px] text-brand-600 hover:underline">
                          {shipment.salesOrder.order_number}
                        </Link>
                      ) : (
                        <p className="text-[13px] text-fg-subtle">—</p>
                      )}
                    </FormField>
                    <FormField label="Transporte">
                      <p className="text-[13px] text-fg">
                        {shipment.carrierAccount?.name ?? FULFILLMENT_KIND_LABEL[shipment.provider_kind]}
                      </p>
                    </FormField>
                    <FormField label="Fecha prometida" htmlFor="promised_date">
                      <DatePicker id="promised_date" value={promisedDate} onChange={setPromisedDate} />
                    </FormField>
                    <FormField label="Costo de envío" htmlFor="shipping_cost">
                      <CurrencyInput id="shipping_cost" value={shippingCost} onChange={setShippingCost} />
                    </FormField>
                    {!isInHouse && (
                      <FormField label="Número de seguimiento" htmlFor="tracking_number" className="sm:col-span-2">
                        <Input
                          id="tracking_number"
                          value={trackingNumber}
                          onChange={e => setTrackingNumber(e.target.value)}
                          placeholder="Código del courier"
                        />
                      </FormField>
                    )}
                    {isInHouse && (
                      <>
                        <FormField label="Código interno (opcional)" htmlFor="internal_tracking" className="sm:col-span-2">
                          <Input
                            id="internal_tracking"
                            value={trackingNumber}
                            onChange={e => setTrackingNumber(e.target.value)}
                            placeholder={shipment.shipment_number}
                          />
                          <p className="text-[12px] text-fg-muted mt-1">Si lo dejás vacío se mantiene el código actual.</p>
                        </FormField>
                        <FormField label="Repartidor" htmlFor="driver_id">
                          <Select
                            id="driver_id"
                            value={driverId}
                            onChange={setDriverId}
                            options={[{ value: '', label: 'Sin repartidor asignado' }, ...drivers.map(d => ({ value: d.id, label: d.name }))]}
                          />
                        </FormField>
                        <FormField label="Vehículo" htmlFor="vehicle_id">
                          <Select
                            id="vehicle_id"
                            value={vehicleId}
                            onChange={setVehicleId}
                            options={[
                              { value: '', label: 'Sin vehículo asignado' },
                              ...vehicles.map(v => ({
                                value: v.id,
                                label: v.plate ? `${v.label} (${v.plate})` : v.label,
                              })),
                            ]}
                          />
                        </FormField>
                      </>
                    )}
                    <FormField label="Indicaciones de entrega" htmlFor="delivery_notes" className="sm:col-span-2">
                      <Textarea
                        id="delivery_notes"
                        value={deliveryNotes}
                        onChange={e => setDeliveryNotes(e.target.value)}
                        rows={3}
                        placeholder="Ej: timbre roto, dejar en portería"
                      />
                    </FormField>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px]">
                  <div>
                    <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Pedido</p>
                    {shipment.salesOrder ? (
                      <Link href={`/ventas/pedidos/${shipment.salesOrder.id}`} className="text-brand-600 hover:underline">
                        {shipment.salesOrder.order_number}
                      </Link>
                    ) : <span className="text-fg-subtle">—</span>}
                  </div>
                  <div>
                    <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Transporte</p>
                    <p className="text-fg">{shipment.carrierAccount?.name ?? FULFILLMENT_KIND_LABEL[shipment.provider_kind]}</p>
                    <p className="text-[12px] text-fg-muted">{FULFILLMENT_KIND_LABEL[shipment.provider_kind]}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">
                      {isInHouse ? 'Código interno' : 'Seguimiento'}
                    </p>
                    {shipment.tracking_number ? (
                      shipment.tracking_url ? (
                        <a href={shipment.tracking_url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline tabular-nums">
                          {shipment.tracking_number}
                        </a>
                      ) : (
                        <p className="text-fg tabular-nums">{shipment.tracking_number}</p>
                      )
                    ) : <span className="text-fg-subtle">—</span>}
                  </div>
                  <div>
                    <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Costo</p>
                    <p className="text-fg tabular-nums">
                      {parseFloat(shipment.shipping_cost) > 0 ? formatARS(shipment.shipping_cost) : '—'}
                    </p>
                  </div>
                  {isInHouse && (
                    <>
                      <div>
                        <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Repartidor</p>
                        <p className="text-fg">{shipment.driver?.name ?? <span className="text-fg-subtle">Sin asignar</span>}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Vehículo</p>
                        <p className="text-fg">{shipment.vehicle_ref ?? <span className="text-fg-subtle">—</span>}</p>
                      </div>
                    </>
                  )}
                  <div>
                    <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Fecha prometida</p>
                    <p className="text-fg">
                      {shipment.promised_date ? new Date(shipment.promised_date).toLocaleDateString('es-AR') : <span className="text-fg-subtle">—</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Entregado</p>
                    <p className="text-fg">
                      {shipment.delivered_at ? new Date(shipment.delivered_at).toLocaleString('es-AR') : <span className="text-fg-subtle">—</span>}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border pt-4 mt-4 text-[13px]">
                  <div>
                    <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-fg-subtle">Destino</p>
                    <p className="text-fg font-medium">{shipment.ship_to_name ?? '—'}</p>
                    <p className="text-fg-muted">{address ?? '—'}</p>
                    {shipment.ship_to_phone && <p className="text-[12px] text-fg-muted">Tel: {shipment.ship_to_phone}</p>}
                  </div>
                  {shipment.delivery_notes && (
                    <div>
                      <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-fg-subtle">Indicaciones de entrega</p>
                      <p className="text-fg-muted whitespace-pre-line">{shipment.delivery_notes}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Items */}
          <div className="bg-surface border border-border rounded-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h2 className="text-[13px] font-semibold text-fg">
                {editMode ? 'Ítems a enviar' : 'Ítems del envío'}
              </h2>
            </div>
            {editMode ? (
              itemLines.length > 0 ? (
                <>
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-surface-muted border-b border-border">
                        <th className="px-4 py-2 text-left font-medium text-fg-muted">Descripción</th>
                        <th className="px-4 py-2 text-right font-medium text-fg-muted">Disponible</th>
                        <th className="px-4 py-2 text-right font-medium text-fg-muted w-28">Enviar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemLines.map(line => (
                        <tr key={line.sales_order_item_id} className="border-b border-border last:border-0">
                          <td className="px-4 py-2.5 text-fg">{line.description}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">{line.remaining}</td>
                          <td className="px-4 py-2.5 text-right">
                            <Input
                              type="number"
                              min={0}
                              max={line.remaining}
                              step="any"
                              value={line.quantity}
                              onChange={e => setLineQuantity(line.sales_order_item_id, e.target.value)}
                              className="h-7 w-24 ml-auto text-right tabular-nums"
                              aria-label={`Cantidad a enviar de ${line.description}`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {itemError && (
                    <p role="alert" className="px-4 py-2 text-[12px] text-danger border-t border-border">
                      {itemError}
                    </p>
                  )}
                </>
              ) : (
                <div className="px-4 py-8 text-center text-[13px] text-fg-subtle">No hay ítems editables.</div>
              )
            ) : items.length > 0 ? (
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-surface-muted border-b border-border">
                    <th className="px-4 py-2 text-left font-medium text-fg-muted">Descripción</th>
                    <th className="px-4 py-2 text-right font-medium text-fg-muted">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 text-fg">
                        {item.description}
                        {orderItemTypes.get(item.sales_order_item_id) === 'service'
                          ? <NonShippableLineBadge />
                          : null}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">{parseFloat(item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-4 py-8 text-center text-[13px] text-fg-subtle">Sin ítems</div>
            )}
          </div>

          {/* Timeline */}
          {!editMode && (
            <div className="bg-surface border border-border rounded-sm p-5">
              <h2 className="text-[13px] font-semibold text-fg mb-3">Seguimiento</h2>
              {events.length === 0 ? (
                <p className="text-[13px] text-fg-muted">Sin eventos registrados.</p>
              ) : (
                <ol className="flex flex-col gap-0">
                  {[...events].reverse().map((event, idx) => (
                    <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                      <div className="flex flex-col items-center">
                        <span className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${idx === 0 ? 'bg-brand-600' : 'bg-border-strong'}`} />
                        {idx < events.length - 1 && <span className="w-px flex-1 bg-border" />}
                      </div>
                      <div className="min-w-0 pb-1">
                        <p className="text-[13px] text-fg font-medium">
                          {SHIPMENT_STATUS_LABEL[event.status]}
                          {event.description && event.description !== SHIPMENT_STATUS_LABEL[event.status] && (
                            <span className="font-normal text-fg-muted"> — {event.description}</span>
                          )}
                        </p>
                        <p className="text-[12px] text-fg-muted">
                          {new Date(event.occurred_at).toLocaleString('es-AR')} · {EVENT_SOURCE_LABEL[event.source] ?? event.source}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      </PageBody>

      <DispatchDialog
        open={dispatchOpen}
        onOpenChange={setDispatchOpen}
        shipment={shipment}
        onDispatched={() => setRefresh(r => r + 1)}
      />

      <EventDialog
        open={eventOpen}
        onOpenChange={setEventOpen}
        shipment={shipment}
        onRecorded={() => setRefresh(r => r + 1)}
      />

      <ConfirmDialog
        open={confirmDeliver}
        onOpenChange={setConfirmDeliver}
        title="Marcar entregado"
        description={`¿Confirmar la entrega del envío ${shipment.shipment_number}? Si el pedido queda completo, pasa a entregado.`}
        confirmLabel="Marcar entregado"
        variant="warning"
        onConfirm={handleDeliver}
      />

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancelar envío"
        description={`¿Cancelar el envío ${shipment.shipment_number}? Las cantidades vuelven a quedar pendientes en el pedido.`}
        confirmLabel="Cancelar envío"
        variant="danger"
        onConfirm={handleCancel}
      />
    </div>
  )
}
