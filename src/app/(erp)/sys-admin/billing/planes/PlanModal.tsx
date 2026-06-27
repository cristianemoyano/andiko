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
import { BILLING_EXTRA_DEFS, type BillingExtraKey } from '@/modules/billing/billing-extras'
import { TRACKED_BILLING_METRICS, type TrackedBillingMetricKey } from '@/modules/billing/billing-metrics.catalog'

export interface PlanRow {
  id: string
  code: string
  name: string
  description: string | null
  interval: string
  base_price: string
  included_seats: number
  per_seat_price: string
  included_branches: number
  per_branch_price: string
  is_active: boolean
  modules?: { module_key: OrgModuleKey; included: boolean; addon_price: string }[]
  extras?: { extra_key: BillingExtraKey; included: boolean; addon_price: string }[]
  metric_allowances?: { metric_key: TrackedBillingMetricKey; included_quantity: string; unit_price: string }[]
}

interface PlanModalProps {
  open: boolean
  plan: PlanRow | null
  onClose: () => void
  onSaved: () => void
}

type FieldErrors = Record<string, string[]>
type ModuleState = Record<OrgModuleKey, { included: boolean; addon_price: string }>
type ExtraState = Record<BillingExtraKey, { included: boolean; addon_price: string }>
type MetricPlanState = Record<TrackedBillingMetricKey, { included: string; unit_price: string }>

function initialMetricPlanState(plan: PlanRow | null): MetricPlanState {
  const base = Object.fromEntries(
    TRACKED_BILLING_METRICS.map(d => [d.key, { included: '0', unit_price: d.default_unit_price }]),
  ) as MetricPlanState
  for (const a of plan?.metric_allowances ?? []) {
    const def = TRACKED_BILLING_METRICS.find(d => d.key === a.metric_key)
    base[a.metric_key] = {
      included: trimAllowanceDisplay(a.included_quantity),
      unit_price: a.unit_price ?? def?.default_unit_price ?? '0.00',
    }
  }
  return base
}

function trimAllowanceDisplay(qty: string): string {
  const n = Number(qty)
  if (Number.isNaN(n)) return '0'
  return Number.isInteger(n) ? String(n) : qty.replace(/\.?0+$/, '')
}

function formatAllowanceSubmit(qty: string): string {
  const n = Number(qty)
  if (Number.isNaN(n) || n <= 0) return '0.0000'
  return Number.isInteger(n) ? `${n}.0000` : n.toFixed(4)
}

function initialModuleState(plan: PlanRow | null): ModuleState {
  const base = Object.fromEntries(
    ORG_MODULE_DEFS.map(d => [d.key, { included: d.tier === 'base', addon_price: '0.00' }]),
  ) as ModuleState
  for (const m of plan?.modules ?? []) {
    base[m.module_key] = { included: m.included, addon_price: m.addon_price }
  }
  return base
}

function initialExtraState(plan: PlanRow | null): ExtraState {
  const base = Object.fromEntries(
    BILLING_EXTRA_DEFS.map(d => [d.key, { included: false, addon_price: '0.00' }]),
  ) as ExtraState
  for (const e of plan?.extras ?? []) {
    base[e.extra_key] = { included: e.included, addon_price: e.addon_price }
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
  const [includedBranches, setIncludedBranches] = useState(() => String(plan?.included_branches ?? 1))
  const [perBranchPrice, setPerBranchPrice] = useState(() => plan?.per_branch_price ?? '0.00')
  const [isActive, setIsActive] = useState(() => plan?.is_active ?? true)
  const [modules, setModules] = useState<ModuleState>(() => initialModuleState(plan))
  const [extras, setExtras] = useState<ExtraState>(() => initialExtraState(plan))
  const [metricPlan, setMetricPlan] = useState<MetricPlanState>(() => initialMetricPlanState(plan))

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
      included_branches: Number(includedBranches),
      per_branch_price: perBranchPrice || '0.00',
      is_active: isActive,
      modules: ORG_MODULE_DEFS.map(d => ({
        module_key: d.key,
        included: modules[d.key].included,
        addon_price: modules[d.key].addon_price || '0.00',
      })),
      extras: BILLING_EXTRA_DEFS.map(d => ({
        extra_key: d.key,
        included: extras[d.key].included,
        addon_price: extras[d.key].addon_price || '0.00',
      })),
      metric_allowances: TRACKED_BILLING_METRICS.map(d => ({
        metric_key: d.key,
        included_quantity: formatAllowanceSubmit(metricPlan[d.key].included),
        unit_price: metricPlan[d.key].unit_price || '0.00',
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

  function setExtra(key: BillingExtraKey, patch: Partial<{ included: boolean; addon_price: string }>) {
    setExtras(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  function setMetric(key: TrackedBillingMetricKey, patch: Partial<{ included: string; unit_price: string }>) {
    setMetricPlan(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="flex flex-col gap-5">
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
        </div>

        <div>
          <div className="text-[13px] font-medium text-fg mb-2">Usuarios</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Usuarios incluidos" htmlFor="plan_seats" error={errors.included_seats?.[0]}>
              <Input id="plan_seats" type="number" min={0} value={includedSeats} onChange={e => setIncludedSeats(e.target.value)} error={!!errors.included_seats} />
            </FormField>
            <FormField label="Precio por usuario extra (ARS)" htmlFor="plan_perseat" error={errors.per_seat_price?.[0]}>
              <CurrencyInput id="plan_perseat" value={perSeatPrice} onChange={setPerSeatPrice} error={!!errors.per_seat_price} />
            </FormField>
          </div>
        </div>

        <div>
          <div className="text-[13px] font-medium text-fg mb-2">Sucursales</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Sucursales incluidas" htmlFor="plan_branches" error={errors.included_branches?.[0]}>
              <Input id="plan_branches" type="number" min={0} value={includedBranches} onChange={e => setIncludedBranches(e.target.value)} error={!!errors.included_branches} />
            </FormField>
            <FormField label="Precio por sucursal extra (ARS)" htmlFor="plan_perbranch" error={errors.per_branch_price?.[0]}>
              <CurrencyInput id="plan_perbranch" value={perBranchPrice} onChange={setPerBranchPrice} error={!!errors.per_branch_price} />
            </FormField>
          </div>
        </div>

        <div>
          <div className="text-[13px] font-medium text-fg mb-1">Consumo medido</div>
          <p className="text-[12px] text-fg-muted mb-3">
            Cupo incluido en el precio base y tarifa por unidad excedente, igual que usuarios o sucursales.
          </p>
          <div className="flex flex-col gap-2">
            {TRACKED_BILLING_METRICS.map(d => (
              <div key={d.key} className="flex items-start gap-3 rounded-sm border border-border px-3 py-2">
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] text-fg">{d.label}</span>
                  <span className="block text-[11px] text-fg-muted mt-0.5">{d.description}</span>
                </span>
                <div className="w-24 shrink-0">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={metricPlan[d.key].included}
                    onChange={e => setMetric(d.key, { included: e.target.value })}
                    aria-label={`Incluidos ${d.label}`}
                  />
                  <span className="block text-[10px] text-fg-muted text-right mt-0.5">
                    incl./mes{d.unit_label ? ` (${d.unit_label})` : ''}
                  </span>
                </div>
                <div className="w-28 shrink-0">
                  <CurrencyInput
                    value={metricPlan[d.key].unit_price}
                    onChange={v => setMetric(d.key, { unit_price: v })}
                    aria-label={`Precio extra ${d.label}`}
                  />
                  <span className="block text-[10px] text-fg-muted text-right mt-0.5">extra</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[13px] font-medium text-fg mb-1">Módulos del plan</div>
          <p className="text-[12px] text-fg-muted mb-3">
            Marcá los módulos incluidos en el precio base. El precio add-on se cobra cuando el módulo se habilita en la suscripción y no está incluido.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['base', 'premium'] as const).map(tier => (
              <div key={tier} className="rounded-sm border border-border p-3">
                <p className="mb-2 text-[12px] font-medium text-fg-muted">
                  {tier === 'base' ? 'Base' : 'Premium'}
                </p>
                <div className="flex flex-col gap-2">
                  {ORG_MODULE_DEFS.filter(d => d.tier === tier).map(d => (
                    <div key={d.key} className="flex items-center gap-3 rounded-sm border border-border/60 px-3 py-2">
                      <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                        <Checkbox
                          checked={modules[d.key].included}
                          onCheckedChange={v => setModule(d.key, { included: v === true })}
                        />
                        <span className="text-[13px] text-fg truncate">{d.label}</span>
                      </label>
                      <div className="w-28 shrink-0">
                        <CurrencyInput
                          value={modules[d.key].addon_price}
                          onChange={v => setModule(d.key, { addon_price: v })}
                          aria-label={`Precio add-on ${d.label}`}
                          disabled={modules[d.key].included}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[13px] font-medium text-fg mb-1">Servicios extra</div>
          <p className="text-[12px] text-fg-muted mb-3">
            Capacitación, soporte y otros servicios opcionales. Si está incluido, forma parte del precio base de la suscripción.
          </p>
          <div className="flex flex-col gap-2">
            {BILLING_EXTRA_DEFS.map(d => (
              <div key={d.key} className="flex items-start gap-3 rounded-sm border border-border px-3 py-2">
                <label className="flex items-start gap-2 flex-1 min-w-0 cursor-pointer pt-0.5">
                  <Checkbox
                    className="mt-0.5"
                    checked={extras[d.key].included}
                    onCheckedChange={v => setExtra(d.key, { included: v === true })}
                  />
                  <span className="min-w-0">
                    <span className="block text-[13px] text-fg">{d.label}</span>
                    <span className="block text-[11px] text-fg-muted mt-0.5">{d.description}</span>
                  </span>
                </label>
                <div className="w-28 shrink-0">
                  <CurrencyInput
                    value={extras[d.key].addon_price}
                    onChange={v => setExtra(d.key, { addon_price: v })}
                    aria-label={`Precio add-on ${d.label}`}
                    disabled={extras[d.key].included}
                  />
                </div>
              </div>
            ))}
          </div>
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
