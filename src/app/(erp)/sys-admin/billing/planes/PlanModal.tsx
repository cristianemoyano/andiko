'use client'

import { useState } from 'react'
import { Dialog } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Checkbox } from '@/components/primitives/Checkbox'
import { FormField } from '@/components/primitives/FormField'
import { CurrencyInput } from '@/components/primitives/CurrencyInput'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { fieldErrorsFromApiError } from '@/lib/validation-errors'
import { ORG_MODULE_DEFS, type OrgModuleKey } from '@/modules/auth/organization-modules'

export interface PlanRow {
  id: string
  code: string
  name: string
  description: string | null
  interval: string
  base_price: string
  included_seats: number
  per_seat_price: string
  is_active: boolean
  modules?: { module_key: OrgModuleKey; included: boolean; addon_price: string }[]
}

interface PlanModalProps {
  open: boolean
  plan: PlanRow | null
  onClose: () => void
  onSaved: () => void
}

type FieldErrors = Record<string, string[]>
type ModuleState = Record<OrgModuleKey, { included: boolean; addon_price: string }>

function initialModuleState(plan: PlanRow | null): ModuleState {
  const base = Object.fromEntries(
    ORG_MODULE_DEFS.map(d => [d.key, { included: d.tier === 'base', addon_price: '0.00' }]),
  ) as ModuleState
  for (const m of plan?.modules ?? []) {
    base[m.module_key] = { included: m.included, addon_price: m.addon_price }
  }
  return base
}

function PlanModalForm({ plan, onClose, onSaved }: Omit<PlanModalProps, 'open'>) {
  const isEdit = plan !== null
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)

  const [code, setCode] = useState(() => plan?.code ?? '')
  const [name, setName] = useState(() => plan?.name ?? '')
  const [interval, setInterval] = useState(() => plan?.interval ?? 'monthly')
  const [basePrice, setBasePrice] = useState(() => plan?.base_price ?? '0.00')
  const [includedSeats, setIncludedSeats] = useState(() => String(plan?.included_seats ?? 1))
  const [perSeatPrice, setPerSeatPrice] = useState(() => plan?.per_seat_price ?? '0.00')
  const [isActive, setIsActive] = useState(() => plan?.is_active ?? true)
  const [modules, setModules] = useState<ModuleState>(() => initialModuleState(plan))

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true); setErrors({}); setServerError(null)

    const body = {
      code: code.trim(),
      name: name.trim(),
      interval,
      base_price: basePrice || '0.00',
      included_seats: Number(includedSeats),
      per_seat_price: perSeatPrice || '0.00',
      is_active: isActive,
      modules: ORG_MODULE_DEFS.map(d => ({
        module_key: d.key,
        included: modules[d.key].included,
        addon_price: modules[d.key].addon_price || '0.00',
      })),
    }

    try {
      const url = isEdit ? `/api/v1/sys-admin/billing/plans/${plan!.id}` : '/api/v1/sys-admin/billing/plans'
      await fetchJson(url, { method: isEdit ? 'PATCH' : 'POST', body: JSON.stringify(body) })
      onSaved()
      onClose()
    } catch (err) {
      const fe = fieldErrorsFromApiError(err)
      if (fe) setErrors(fe)
      else setServerError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  function setModule(key: OrgModuleKey, patch: Partial<{ included: boolean; addon_price: string }>) {
    setModules(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Código" htmlFor="plan_code" error={errors.code?.[0]}>
            <Input id="plan_code" value={code} onChange={e => setCode(e.target.value)} placeholder="pro_mensual" error={!!errors.code} required />
          </FormField>
          <FormField label="Nombre" htmlFor="plan_name" error={errors.name?.[0]}>
            <Input id="plan_name" value={name} onChange={e => setName(e.target.value)} placeholder="Pro" error={!!errors.name} required />
          </FormField>
          <FormField label="Ciclo" htmlFor="plan_interval" error={errors.interval?.[0]}>
            <Select id="plan_interval" value={interval} onChange={setInterval} options={[
              { value: 'monthly', label: 'Mensual' },
              { value: 'annual', label: 'Anual' },
            ]} />
          </FormField>
          <FormField label="Precio base (ARS)" htmlFor="plan_base" error={errors.base_price?.[0]}>
            <CurrencyInput id="plan_base" value={basePrice} onChange={setBasePrice} error={!!errors.base_price} />
          </FormField>
          <FormField label="Usuarios incluidos" htmlFor="plan_seats" error={errors.included_seats?.[0]}>
            <Input id="plan_seats" type="number" min={0} value={includedSeats} onChange={e => setIncludedSeats(e.target.value)} error={!!errors.included_seats} />
          </FormField>
          <FormField label="Precio por usuario extra (ARS)" htmlFor="plan_perseat" error={errors.per_seat_price?.[0]}>
            <CurrencyInput id="plan_perseat" value={perSeatPrice} onChange={setPerSeatPrice} error={!!errors.per_seat_price} />
          </FormField>
        </div>

        <div>
          <div className="text-[13px] font-medium text-fg mb-2">Módulos del plan</div>
          <div className="flex flex-col gap-2">
            {ORG_MODULE_DEFS.map(d => (
              <div key={d.key} className="flex items-center gap-3 rounded-sm border border-border px-3 py-2">
                <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                  <Checkbox
                    checked={modules[d.key].included}
                    onCheckedChange={v => setModule(d.key, { included: v === true })}
                  />
                  <span className="text-[13px] text-fg truncate">{d.label}</span>
                </label>
                <div className="w-32 shrink-0">
                  <CurrencyInput
                    value={modules[d.key].addon_price}
                    onChange={v => setModule(d.key, { addon_price: v })}
                    aria-label={`Precio add-on ${d.label}`}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[12px] text-fg-muted mt-1.5">El precio se cobra como add-on cuando el módulo se habilita en la suscripción.</p>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={isActive} onCheckedChange={v => setIsActive(v === true)} />
          <span className="text-[13px] text-fg">Plan activo</span>
        </label>

        {serverError && (
          <p role="alert" className="text-[12px] text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">{serverError}</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" size="sm" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
        </div>
      </div>
    </form>
  )
}

export function PlanModal({ open, plan, onClose, onSaved }: PlanModalProps) {
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }} title={plan ? 'Editar plan' : 'Nuevo plan'} size="lg">
      {open ? (
        <PlanModalForm key={plan?.id ?? 'new'} plan={plan} onClose={onClose} onSaved={onSaved} />
      ) : null}
    </Dialog>
  )
}
