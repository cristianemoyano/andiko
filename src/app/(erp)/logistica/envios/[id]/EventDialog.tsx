'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogFooter } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import {
  SHIPMENT_STATUS_LABEL,
  SHIPMENT_TRANSITIONS,
  type ShipmentStatus,
} from '@/modules/logistics/logistics.constants'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifySuccess } from '@/lib/notify'
import type { ShipmentDetailData } from '../../types'

export interface EventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shipment: ShipmentDetailData
  onRecorded: () => void
}

/** Carga manual de un evento de seguimiento (avanza el estado si corresponde). */
export function EventDialog({ open, onOpenChange, shipment, onRecorded }: EventDialogProps) {
  const nextStatuses = SHIPMENT_TRANSITIONS[shipment.status].filter(s => s !== 'cancelled')
  const [status, setStatus] = useState<ShipmentStatus | ''>('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setStatus(nextStatuses[0] ?? '')
      setDescription('')
      setServerError(null)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function handleSave() {
    if (!status) return
    setSaving(true)
    setServerError(null)
    try {
      await fetchJson(`/api/v1/logistics/shipments/${shipment.id}/events`, {
        method: 'POST',
        body: JSON.stringify({
          status,
          ...(description.trim() ? { description: description.trim() } : {}),
        }),
      })
      notifySuccess('Evento de seguimiento registrado')
      onOpenChange(false)
      onRecorded()
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
      title="Registrar evento de seguimiento"
      description={`${shipment.shipment_number} · estado actual: ${SHIPMENT_STATUS_LABEL[shipment.status]}`}
      footer={
        <DialogFooter error={serverError}>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !status}>
            {saving ? 'Guardando…' : 'Registrar evento'}
          </Button>
        </DialogFooter>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label="Nuevo estado" htmlFor="event_status">
          <Select
            id="event_status"
            value={status}
            onChange={v => setStatus(v as ShipmentStatus)}
            options={nextStatuses.map(s => ({ value: s, label: SHIPMENT_STATUS_LABEL[s] }))}
            placeholder="Seleccionar estado…"
          />
        </FormField>
        <FormField label="Descripción" htmlFor="event_description">
          <Input
            id="event_description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Ej: Llegó a sucursal Godoy Cruz"
            maxLength={255}
          />
        </FormField>
      </div>
    </Dialog>
  )
}
