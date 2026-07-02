'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogFooter } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { CurrencyInput } from '@/components/primitives/CurrencyInput'
import { FULFILLMENT_KIND_LABEL } from '@/modules/logistics/logistics.constants'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifySuccess } from '@/lib/notify'
import type { ShipmentDetailData, DriverOption } from '../../types'

export interface DispatchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shipment: ShipmentDetailData
  onDispatched: () => void
}

export function DispatchDialog({ open, onOpenChange, shipment, onDispatched }: DispatchDialogProps) {
  const isInHouse = shipment.provider_kind === 'in_house'
  const [trackingNumber, setTrackingNumber] = useState('')
  const [shippingCost, setShippingCost] = useState('')
  const [driverId, setDriverId] = useState('')
  const [vehicleRef, setVehicleRef] = useState('')
  const [drivers, setDrivers] = useState<DriverOption[]>([])
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setTrackingNumber(shipment.tracking_number ?? '')
      setShippingCost(shipment.shipping_cost !== '0.00' ? shipment.shipping_cost : '')
      setDriverId(shipment.assigned_driver_id ?? '')
      setVehicleRef(shipment.vehicle_ref ?? '')
      setServerError(null)
    })
  }, [open, shipment])

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

  async function handleDispatch() {
    setSaving(true)
    setServerError(null)
    try {
      await fetchJson(`/api/v1/logistics/shipments/${shipment.id}/dispatch`, {
        method: 'POST',
        body: JSON.stringify({
          ...(trackingNumber.trim() ? { tracking_number: trackingNumber.trim() } : {}),
          ...(shippingCost !== '' ? { shipping_cost: parseFloat(shippingCost) || 0 } : {}),
          ...(isInHouse && driverId ? { assigned_driver_id: driverId } : {}),
          ...(isInHouse && vehicleRef.trim() ? { vehicle_ref: vehicleRef.trim() } : {}),
        }),
      })
      notifySuccess(`Envío ${shipment.shipment_number} despachado`)
      onOpenChange(false)
      onDispatched()
    } catch (e) {
      setServerError(getApiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Despachar envío"
      description={`${shipment.shipment_number} · ${FULFILLMENT_KIND_LABEL[shipment.provider_kind]}`}
      footer={
        <DialogFooter error={serverError}>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleDispatch} disabled={saving}>
            {saving ? 'Despachando…' : 'Despachar'}
          </Button>
        </DialogFooter>
      }
    >
      <div className="flex flex-col gap-4">
        {!isInHouse && (
          <FormField label="Número de seguimiento" htmlFor="tracking_number">
            <Input
              id="tracking_number"
              value={trackingNumber}
              onChange={e => setTrackingNumber(e.target.value)}
              placeholder="Lo asigna el courier al despachar"
            />
          </FormField>
        )}
        {isInHouse && (
          <>
            <FormField label="Chofer" htmlFor="driver_id">
              <Select
                id="driver_id"
                value={driverId}
                onChange={setDriverId}
                options={[{ value: '', label: 'Sin chofer asignado' }, ...drivers.map(d => ({ value: d.id, label: d.name }))]}
                placeholder="Seleccionar chofer…"
              />
            </FormField>
            <FormField label="Vehículo" htmlFor="vehicle_ref">
              <Input
                id="vehicle_ref"
                value={vehicleRef}
                onChange={e => setVehicleRef(e.target.value)}
                placeholder="Ej: Fiorino AB123CD"
              />
            </FormField>
          </>
        )}
        <FormField label="Costo de envío (ARS)" htmlFor="shipping_cost">
          <CurrencyInput
            id="shipping_cost"
            value={shippingCost}
            onChange={setShippingCost}
          />
        </FormField>
      </div>
    </Dialog>
  )
}
