'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogFooter } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Switch } from '@/components/primitives/Switch'
import { Textarea } from '@/components/primitives/Textarea'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifySuccess } from '@/lib/notify'
import { fieldErrorsFromApiError } from '@/lib/validation-errors'
import type { VehicleRow } from '../types'

export interface VehicleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehicle: VehicleRow | null
  onSaved: () => void
}

export function VehicleDialog({ open, onOpenChange, vehicle, onSaved }: VehicleDialogProps) {
  const isEdit = !!vehicle
  const [label, setLabel] = useState('')
  const [plate, setPlate] = useState('')
  const [branchId, setBranchId] = useState('')
  const [notes, setNotes] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [branches, setBranches] = useState<Array<{ id: string; name: string; branch_code: number }>>([])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setLabel(vehicle?.label ?? '')
      setPlate(vehicle?.plate ?? '')
      setBranchId(vehicle?.branch_id ?? '')
      setNotes(vehicle?.notes ?? '')
      setIsActive(vehicle?.is_active ?? true)
      setErrors({})
      setServerError(null)
    })
  }, [open, vehicle])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetchJson<{ data: Array<{ id: string; name: string; branch_code: number }> }>('/api/v1/branches?limit=100')
        if (!cancelled) setBranches(res.data ?? [])
      } catch {
        if (!cancelled) setBranches([])
      }
    })()
    return () => { cancelled = true }
  }, [open])

  async function handleSave() {
    setSaving(true)
    setErrors({})
    setServerError(null)
    const body = {
      label: label.trim(),
      plate: plate.trim() || null,
      branch_id: branchId || null,
      notes: notes.trim() || null,
      is_active: isActive,
    }
    try {
      if (isEdit) {
        await fetchJson(`/api/v1/logistics/vehicles/${vehicle.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      } else {
        await fetchJson('/api/v1/logistics/vehicles', {
          method: 'POST',
          body: JSON.stringify(body),
        })
      }
      notifySuccess(isEdit ? 'Vehículo actualizado' : 'Vehículo creado')
      onOpenChange(false)
      onSaved()
    } catch (e) {
      const fe = fieldErrorsFromApiError(e)
      if (fe) setErrors(fe)
      else setServerError(getApiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Editar vehículo' : 'Nuevo vehículo'}
      footer={
        <DialogFooter error={serverError}>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !label.trim()}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label="Nombre / modelo" htmlFor="vehicle_label" required error={errors.label?.[0]}>
          <Input id="vehicle_label" value={label} onChange={e => setLabel(e.target.value)} placeholder="Ej: Fiorino blanco" />
        </FormField>
        <FormField label="Patente" htmlFor="vehicle_plate" error={errors.plate?.[0]}>
          <Input id="vehicle_plate" value={plate} onChange={e => setPlate(e.target.value)} placeholder="Ej: AB123CD" />
        </FormField>
        <FormField label="Sucursal" htmlFor="vehicle_branch">
          <Select
            id="vehicle_branch"
            value={branchId}
            onChange={setBranchId}
            options={[
              { value: '', label: 'Todas las sucursales' },
              ...branches.map(b => ({ value: b.id, label: `${b.name} (${b.branch_code})` })),
            ]}
          />
        </FormField>
        <FormField label="Notas" htmlFor="vehicle_notes">
          <Textarea id="vehicle_notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
        </FormField>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-fg-muted">Activo</span>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
      </div>
    </Dialog>
  )
}
