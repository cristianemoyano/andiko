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
import type { ShipmentDetailData, DriverOption, VehicleOption } from '../../types'

export interface DispatchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shipment: ShipmentDetailData
  onDispatched: () => void
}

export function DispatchDialog({ open, onOpenChange, shipment, onDispatched }: DispatchDialogProps) {
  const isInHouse = shipment.provider_kind === 'in_house'
  const hasShippingCost = parseFloat(shipment.shipping_cost) > 0
  const [trackingNumber, setTrackingNumber] = useState('')
  const [shippingCost, setShippingCost] = useState('')
  const [driverId, setDriverId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [drivers, setDrivers] = useState<DriverOption[]>([])
  const [vehicles, setVehicles] = useState<VehicleOption[]>([])
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setTrackingNumber(shipment.tracking_number ?? '')
      setShippingCost(shipment.shipping_cost !== '0.00' ? shipment.shipping_cost : '')
      setDriverId(shipment.assigned_driver_id ?? '')
      setVehicleId(shipment.vehicle_id ?? '')
      setServerError(null)
    })
  }, [open, shipment])

  useEffect(() => {
    if (!open || !isInHouse) return
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
          ...(isInHouse ? { vehicle_id: vehicleId || null } : {}),
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
            {(shipment.tracking_number ?? shipment.shipment_number) && (
              <FormField label="Código de seguimiento interno" htmlFor="internal_tracking">
                <Input
                  id="internal_tracking"
                  value={shipment.tracking_number ?? shipment.shipment_number}
                  readOnly
                  className="tabular-nums bg-surface-2"
                />
              </FormField>
            )}
            <FormField label="Repartidor" htmlFor="driver_id">
              <Select
                id="driver_id"
                value={driverId}
                onChange={setDriverId}
                options={[{ value: '', label: 'Sin repartidor asignado' }, ...drivers.map(d => ({ value: d.id, label: d.name }))]}
                placeholder="Seleccionar repartidor…"
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
                placeholder="Seleccionar vehículo…"
              />
            </FormField>
            {vehicles.length === 0 && (
              <p className="text-[12px] text-fg-muted">
                Cargá vehículos en{' '}
                <a href="/logistica/vehiculos" className="text-brand-600 hover:underline">Logística → Vehículos</a>.
              </p>
            )}
          </>
        )}
        {!hasShippingCost && (
          <FormField label="Costo de envío (opcional)" htmlFor="shipping_cost">
            <CurrencyInput
              id="shipping_cost"
              value={shippingCost}
              onChange={setShippingCost}
            />
            <p className="text-[12px] text-fg-muted">Solo si no quedó definido al crear el envío.</p>
          </FormField>
        )}
      </div>
    </Dialog>
  )
}
