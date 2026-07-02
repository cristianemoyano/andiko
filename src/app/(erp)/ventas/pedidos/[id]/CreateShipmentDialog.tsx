'use client'

import { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogFooter } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Textarea } from '@/components/primitives/Textarea'
import { CurrencyInput } from '@/components/primitives/CurrencyInput'
import { FULFILLMENT_KIND_LABEL, type FulfillmentKind } from '@/modules/logistics/logistics.constants'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifySuccess } from '@/lib/notify'
import type { Order } from '../../types'

type CarrierOption = {
  id: string
  kind: FulfillmentKind
  name: string
  branch_id: string | null
  settings: Record<string, unknown>
}

type DriverOption = { id: string; name: string }

type ShipmentLine = {
  sales_order_item_id: string
  description: string
  remaining: number
  quantity: string
}

export interface CreateShipmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: Order
  onCreated: () => void
}

function pendingLines(order: Order): ShipmentLine[] {
  return (order.items ?? [])
    .map(item => {
      const remaining = (parseFloat(item.quantity) || 0) - (parseFloat(item.shipped_qty ?? '0') || 0)
      return {
        sales_order_item_id: item.id,
        description: item.description,
        remaining,
        quantity: String(remaining),
      }
    })
    .filter(line => line.remaining > 0)
}

export function CreateShipmentDialog({ open, onOpenChange, order, onCreated }: CreateShipmentDialogProps) {
  const [carriers, setCarriers] = useState<CarrierOption[]>([])
  const [carrierId, setCarrierId] = useState('')
  const [lines, setLines] = useState<ShipmentLine[]>([])
  const [trackingNumber, setTrackingNumber] = useState('')
  const [driverId, setDriverId] = useState('')
  const [vehicleRef, setVehicleRef] = useState('')
  const [shippingCost, setShippingCost] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [drivers, setDrivers] = useState<DriverOption[]>([])
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const carrier = useMemo(() => carriers.find(c => c.id === carrierId) ?? null, [carriers, carrierId])
  const isInHouse = carrier?.kind === 'in_house'

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setLines(pendingLines(order))
      setTrackingNumber('')
      setDriverId('')
      setVehicleRef('')
      setShippingCost('')
      setDeliveryNotes('')
      setServerError(null)
    })
  }, [open, order])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      try {
        const params = new URLSearchParams({ is_active: 'true', limit: '100' })
        if (order.branch_id) params.set('branch_id', order.branch_id)
        const res = await fetchJson<{ data: CarrierOption[] }>(`/api/v1/logistics/carrier-accounts?${params}`)
        if (cancelled) return
        const rows = res.data ?? []
        setCarriers(rows)
        setCarrierId(prev => prev || (rows[0]?.id ?? ''))
      } catch {
        if (!cancelled) setCarriers([])
      }
    })()
    return () => { cancelled = true }
  }, [open, order.branch_id])

  useEffect(() => {
    if (!open || !isInHouse) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetchJson<{ data: DriverOption[] }>('/api/v1/logistics/drivers')
        if (!cancelled) setDrivers(res.data ?? [])
      } catch {
        if (!cancelled) setDrivers([])
      }
    })()
    return () => { cancelled = true }
  }, [open, isInHouse])

  function setLineQuantity(id: string, quantity: string) {
    setLines(prev => prev.map(line => line.sales_order_item_id === id ? { ...line, quantity } : line))
  }

  const invalidLine = lines.find(line => {
    const qty = parseFloat(line.quantity)
    return isNaN(qty) || qty < 0 || qty > line.remaining
  })
  const selectedLines = lines.filter(line => (parseFloat(line.quantity) || 0) > 0)
  const canSave = !!carrierId && !invalidLine && selectedLines.length > 0 && !saving

  async function handleCreate() {
    setSaving(true)
    setServerError(null)
    try {
      await fetchJson('/api/v1/logistics/shipments', {
        method: 'POST',
        body: JSON.stringify({
          sales_order_id: order.id,
          carrier_account_id: carrierId,
          items: selectedLines.map(line => ({
            sales_order_item_id: line.sales_order_item_id,
            quantity: parseFloat(line.quantity),
          })),
          ...(order.contact?.legal_name ? { ship_to_name: order.contact.legal_name } : {}),
          ...(trackingNumber.trim() ? { tracking_number: trackingNumber.trim() } : {}),
          ...(isInHouse && driverId ? { assigned_driver_id: driverId } : {}),
          ...(isInHouse && vehicleRef.trim() ? { vehicle_ref: vehicleRef.trim() } : {}),
          ...(shippingCost !== '' ? { shipping_cost: parseFloat(shippingCost) || 0 } : {}),
          ...(deliveryNotes.trim() ? { delivery_notes: deliveryNotes.trim() } : {}),
        }),
      })
      notifySuccess(`Envío generado para el pedido ${order.order_number}`)
      onOpenChange(false)
      onCreated()
    } catch (e) {
      setServerError(getApiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const shippingSummary = [
    `${order.shipping_street ?? ''}${order.shipping_number ? ` ${order.shipping_number}` : ''}`.trim(),
    order.shipping_city,
    order.shipping_province,
  ].filter(Boolean).join(', ')

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Generar envío"
      description={`Pedido ${order.order_number} · se envía a la dirección de entrega del pedido.`}
      size="lg"
      footer={
        <DialogFooter error={serverError}>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleCreate} disabled={!canSave}>
            {saving ? 'Generando…' : 'Generar envío'}
          </Button>
        </DialogFooter>
      }
    >
      <div className="flex flex-col gap-4">
        {carriers.length === 0 ? (
          <p className="rounded-sm border border-warning bg-warning-bg px-3 py-2 text-[13px] text-warning">
            No hay transportistas activos. Configurá al menos uno en{' '}
            <a href="/logistica/transportistas" className="underline">Logística → Transportistas</a>.
          </p>
        ) : (
          <FormField label="Transportista" htmlFor="carrier_account_id" required>
            <Select
              id="carrier_account_id"
              value={carrierId}
              onChange={setCarrierId}
              options={carriers.map(c => ({
                value: c.id,
                label: `${c.name} (${FULFILLMENT_KIND_LABEL[c.kind]})`,
              }))}
              placeholder="Seleccionar transportista…"
            />
          </FormField>
        )}

        {carrier && !isInHouse && (
          <FormField label="Número de seguimiento (opcional)" htmlFor="shipment_tracking">
            <Input
              id="shipment_tracking"
              value={trackingNumber}
              onChange={e => setTrackingNumber(e.target.value)}
              placeholder="Se puede cargar después, al despachar"
            />
          </FormField>
        )}

        {isInHouse && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Chofer" htmlFor="shipment_driver">
              <Select
                id="shipment_driver"
                value={driverId}
                onChange={setDriverId}
                options={[{ value: '', label: 'Sin chofer asignado' }, ...drivers.map(d => ({ value: d.id, label: d.name }))]}
              />
            </FormField>
            <FormField label="Vehículo" htmlFor="shipment_vehicle">
              <Input
                id="shipment_vehicle"
                value={vehicleRef}
                onChange={e => setVehicleRef(e.target.value)}
                placeholder="Ej: Fiorino AB123CD"
              />
            </FormField>
          </div>
        )}

        <div className="rounded-sm border border-border overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-surface-muted">
            <p className="text-[12px] font-medium text-fg-muted">Ítems a enviar</p>
          </div>
          {lines.length === 0 ? (
            <p className="px-3 py-4 text-[13px] text-fg-subtle">No quedan ítems pendientes de envío.</p>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-1.5 text-left font-medium text-fg-muted">Descripción</th>
                  <th className="px-3 py-1.5 text-right font-medium text-fg-muted">Pendiente</th>
                  <th className="px-3 py-1.5 text-right font-medium text-fg-muted w-28">Enviar</th>
                </tr>
              </thead>
              <tbody>
                {lines.map(line => (
                  <tr key={line.sales_order_item_id} className="border-b border-border last:border-0">
                    <td className="px-3 py-1.5 text-fg">{line.description}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-fg-muted">{line.remaining}</td>
                    <td className="px-3 py-1.5 text-right">
                      <Input
                        type="number"
                        min={0}
                        max={line.remaining}
                        step="any"
                        value={line.quantity}
                        onChange={e => setLineQuantity(line.sales_order_item_id, e.target.value)}
                        className="h-7 w-24 text-right tabular-nums"
                        aria-label={`Cantidad a enviar de ${line.description}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {invalidLine && (
            <p role="alert" className="px-3 py-2 text-[12px] text-danger border-t border-border">
              La cantidad a enviar de «{invalidLine.description}» debe estar entre 0 y {invalidLine.remaining}.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Costo de envío (ARS)" htmlFor="shipment_cost">
            <CurrencyInput id="shipment_cost" value={shippingCost} onChange={setShippingCost} />
          </FormField>
          <FormField label="Indicaciones de entrega" htmlFor="shipment_notes">
            <Textarea
              id="shipment_notes"
              value={deliveryNotes}
              onChange={e => setDeliveryNotes(e.target.value)}
              rows={2}
              placeholder="Ej: dejar en portería"
            />
          </FormField>
        </div>

        <p className="text-[12px] text-fg-muted">
          Destino: {shippingSummary || 'sin dirección de entrega cargada en el pedido'}
          {order.contact?.legal_name ? ` · ${order.contact.legal_name}` : ''}
        </p>
      </div>
    </Dialog>
  )
}
