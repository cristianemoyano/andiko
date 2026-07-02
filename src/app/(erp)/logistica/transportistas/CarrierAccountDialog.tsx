'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogFooter } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Switch } from '@/components/primitives/Switch'
import { CurrencyInput } from '@/components/primitives/CurrencyInput'
import { FULFILLMENT_KINDS, FULFILLMENT_KIND_LABEL, type FulfillmentKind } from '@/modules/logistics/logistics.constants'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifySuccess } from '@/lib/notify'
import { fieldErrorsFromApiError } from '@/lib/validation-errors'
import type { CarrierAccountRow } from '../types'

export interface CarrierAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null = crear */
  account: CarrierAccountRow | null
  onSaved: () => void
}

export function CarrierAccountDialog({ open, onOpenChange, account, onSaved }: CarrierAccountDialogProps) {
  const isEdit = !!account
  const [kind, setKind] = useState<FulfillmentKind>('in_house')
  const [name, setName] = useState('')
  const [branchId, setBranchId] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [flatRate, setFlatRate] = useState('')
  const [branches, setBranches] = useState<Array<{ id: string; name: string; branch_code: number }>>([])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setKind(account?.kind ?? 'in_house')
      setName(account?.name ?? '')
      setBranchId(account?.branch_id ?? '')
      setIsActive(account?.is_active ?? true)
      const rate = account?.settings?.flat_rate
      setFlatRate(typeof rate === 'number' ? String(rate) : '')
      setErrors({})
      setServerError(null)
    })
  }, [open, account])

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
      kind,
      name: name.trim(),
      branch_id: branchId || null,
      is_active: isActive,
      settings: flatRate !== '' ? { flat_rate: parseFloat(flatRate) || 0 } : {},
    }
    try {
      if (isEdit) {
        await fetchJson(`/api/v1/logistics/carrier-accounts/${account.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      } else {
        await fetchJson('/api/v1/logistics/carrier-accounts', {
          method: 'POST',
          body: JSON.stringify(body),
        })
      }
      notifySuccess(isEdit ? 'Transportista actualizado' : 'Transportista creado')
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
      title={isEdit ? 'Editar transportista' : 'Nuevo transportista'}
      description="Canal de entrega disponible al generar envíos desde un pedido."
      footer={
        <DialogFooter error={serverError}>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear transportista'}
          </Button>
        </DialogFooter>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label="Tipo" htmlFor="carrier_kind" error={errors.kind?.[0]}>
          <Select
            id="carrier_kind"
            value={kind}
            onChange={v => setKind(v as FulfillmentKind)}
            options={FULFILLMENT_KINDS.map(k => ({ value: k, label: FULFILLMENT_KIND_LABEL[k] }))}
            disabled={isEdit}
          />
        </FormField>
        <FormField label="Nombre" htmlFor="carrier_name" required error={errors.name?.[0]}>
          <Input
            id="carrier_name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={kind === 'in_house' ? 'Ej: Reparto propio' : 'Ej: OCA Mendoza'}
            maxLength={120}
          />
        </FormField>
        <FormField label="Sucursal" htmlFor="carrier_branch" error={errors.branch_id?.[0]}>
          <Select
            id="carrier_branch"
            value={branchId}
            onChange={setBranchId}
            options={[
              { value: '', label: 'Todas las sucursales' },
              ...branches.map(b => ({ value: b.id, label: `${String(b.branch_code).padStart(2, '0')} — ${b.name}` })),
            ]}
          />
        </FormField>
        <FormField label="Costo fijo por envío (ARS)" htmlFor="carrier_flat_rate">
          <CurrencyInput id="carrier_flat_rate" value={flatRate} onChange={setFlatRate} />
          <p className="text-[12px] text-fg-muted">Se aplica automáticamente al generar envíos con este transportista.</p>
        </FormField>
        <div className="flex items-center justify-between rounded-sm border border-border px-3 py-2.5">
          <span className="text-[13px] text-fg">Activo</span>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
      </div>
    </Dialog>
  )
}
