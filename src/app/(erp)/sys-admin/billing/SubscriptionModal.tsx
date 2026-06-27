'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Checkbox } from '@/components/primitives/Checkbox'
import { FormField } from '@/components/primitives/FormField'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { fieldErrorsFromApiError } from '@/lib/validation-errors'
import { ORG_MODULE_DEFS, type OrgModuleKey } from '@/modules/auth/organization-modules'
import { BILLING_EXTRA_DEFS, type BillingExtraKey } from '@/modules/billing/billing-extras'
import { TRACKED_BILLING_METRICS, type TrackedBillingMetricKey } from '@/modules/billing/billing-metrics.catalog'
import type { SubscriptionStatus } from '@/types'

interface OrgRef { id: string; name: string }
interface PlanRef { id: string; name: string }

interface PlanModuleRow {
  module_key: OrgModuleKey
  included: boolean
  addon_price: string
}

interface PlanExtraRow {
  extra_key: BillingExtraKey
  included: boolean
  addon_price: string
}

interface PlanMetricAllowanceRow {
  metric_key: TrackedBillingMetricKey
  included_quantity: string
  unit_price?: string
}

interface PlanDetail extends PlanRef {
  included_seats?: number
  modules?: PlanModuleRow[]
  extras?: PlanExtraRow[]
  metric_allowances?: PlanMetricAllowanceRow[]
}

export interface SubscriptionForEdit {
  id: string
  org_id: string
  plan_id: string
  seats: number
  status: SubscriptionStatus
  addons?: { module_key: string; unit_price: string; enabled: boolean }[]
  extras?: { extra_key: string; unit_price: string; enabled: boolean }[]
  metric_allowances?: { metric_key: TrackedBillingMetricKey; extra_included_quantity: string }[]
}

interface SubscriptionModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  subscription?: SubscriptionForEdit | null
}

type FieldErrors = Record<string, string[]>
type MetricExtraState = Record<TrackedBillingMetricKey, string>

function planMetricIncluded(plan: PlanDetail | null, key: TrackedBillingMetricKey): string {
  const row = plan?.metric_allowances?.find(a => a.metric_key === key)
  return row?.included_quantity ?? '0.0000'
}

function planMetricUnitPrice(plan: PlanDetail | null, key: TrackedBillingMetricKey): string | null {
  const row = plan?.metric_allowances?.find(a => a.metric_key === key)
  return row?.unit_price ?? null
}

function trimAllowanceDisplay(qty: string): string {
  const n = Number(qty)
  if (Number.isNaN(n) || n <= 0) return ''
  return Number.isInteger(n) ? String(n) : qty.replace(/\.?0+$/, '')
}

function formatAllowanceSubmit(qty: string): string {
  const n = Number(qty)
  if (Number.isNaN(n) || n <= 0) return '0.0000'
  return Number.isInteger(n) ? `${n}.0000` : n.toFixed(4)
}

function initialMetricExtras(
  subscription: SubscriptionForEdit | null | undefined,
): MetricExtraState {
  const base = Object.fromEntries(
    TRACKED_BILLING_METRICS.map(d => [d.key, '']),
  ) as MetricExtraState
  for (const a of subscription?.metric_allowances ?? []) {
    base[a.metric_key] = trimAllowanceDisplay(a.extra_included_quantity)
  }
  return base
}

function planModule(plan: PlanDetail | null, key: OrgModuleKey): PlanModuleRow | undefined {
  return plan?.modules?.find(m => m.module_key === key)
}

function planExtra(plan: PlanDetail | null, key: BillingExtraKey): PlanExtraRow | undefined {
  return plan?.extras?.find(e => e.extra_key === key)
}

function buildAddons(plan: PlanDetail, enabledModules: Set<OrgModuleKey>) {
  return ORG_MODULE_DEFS
    .filter(d => {
      const pm = planModule(plan, d.key)
      if (!pm || pm.included) return false
      return enabledModules.has(d.key)
    })
    .map(d => ({
      module_key: d.key,
      unit_price: planModule(plan, d.key)!.addon_price,
      enabled: true,
    }))
}

function buildExtras(plan: PlanDetail, enabledExtras: Set<BillingExtraKey>) {
  return BILLING_EXTRA_DEFS.flatMap(d => {
    const pe = planExtra(plan, d.key)
    if (!pe) return []
    const enabled = pe.included || enabledExtras.has(d.key)
    if (!enabled) return []
    return [{
      extra_key: d.key,
      unit_price: pe.included ? '0.00' : pe.addon_price,
      enabled: true,
    }]
  })
}

function initialEnabledModules(
  plan: PlanDetail | null,
  subscription: SubscriptionForEdit | null | undefined,
): Set<OrgModuleKey> {
  const enabled = new Set<OrgModuleKey>()
  if (subscription?.addons) {
    for (const a of subscription.addons) {
      if (a.enabled) enabled.add(a.module_key as OrgModuleKey)
    }
  }
  return enabled
}

function initialEnabledExtras(
  plan: PlanDetail | null,
  subscription: SubscriptionForEdit | null | undefined,
): Set<BillingExtraKey> {
  const enabled = new Set<BillingExtraKey>()
  if (subscription?.extras) {
    for (const e of subscription.extras) {
      if (e.enabled && Number(e.unit_price) > 0) enabled.add(e.extra_key as BillingExtraKey)
    }
  }
  return enabled
}

function SubscriptionForm({
  subscription,
  onClose,
  onSaved,
}: Pick<SubscriptionModalProps, 'subscription' | 'onClose' | 'onSaved'>) {
  const isEdit = !!subscription
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [orgs, setOrgs] = useState<OrgRef[]>([])
  const [plans, setPlans] = useState<PlanRef[]>([])
  const [planDetail, setPlanDetail] = useState<PlanDetail | null>(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [orgId, setOrgId] = useState(() => subscription?.org_id ?? '')
  const [planId, setPlanId] = useState(() => subscription?.plan_id ?? '')
  const [seats, setSeats] = useState(() => String(subscription?.seats ?? 1))
  const [status, setStatus] = useState(() => subscription?.status ?? 'trialing')
  const [enabledModules, setEnabledModules] = useState<Set<OrgModuleKey>>(() => new Set())
  const [enabledExtras, setEnabledExtras] = useState<Set<BillingExtraKey>>(() => new Set())
  const [metricExtras, setMetricExtras] = useState<MetricExtraState>(() => initialMetricExtras(subscription))

  useEffect(() => {
    void (async () => {
      try {
        const [o, p] = await Promise.all([
          fetchJson<{ data: OrgRef[] }>('/api/v1/sys-admin/organizations?limit=500'),
          fetchJson<{ data: PlanRef[] }>('/api/v1/sys-admin/billing/plans?is_active=true&limit=100'),
        ])
        setOrgs(o.data ?? [])
        setPlans(p.data ?? [])
      } catch {
        setOrgs([])
        setPlans([])
      }
    })()
  }, [])

  const loadPlan = useCallback(async (id: string, sub: SubscriptionForEdit | null | undefined) => {
    if (!id) {
      setPlanDetail(null)
      setEnabledModules(new Set())
      setEnabledExtras(new Set())
      setMetricExtras(initialMetricExtras(null))
      return
    }
    setPlanLoading(true)
    try {
      const plan = await fetchJson<PlanDetail>(`/api/v1/sys-admin/billing/plans/${id}`)
      setPlanDetail(plan)
      setEnabledModules(initialEnabledModules(plan, sub))
      setEnabledExtras(initialEnabledExtras(plan, sub))
      setMetricExtras(initialMetricExtras(sub))
      if (!isEdit && plan.included_seats != null) {
        setSeats(String(Math.max(1, plan.included_seats)))
      }
    } catch {
      setPlanDetail(null)
      setEnabledModules(new Set())
      setEnabledExtras(new Set())
      setMetricExtras(initialMetricExtras(null))
    } finally {
      setPlanLoading(false)
    }
  }, [isEdit])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadPlan resets loading state before async fetch
    if (planId) void loadPlan(planId, subscription)
    else setPlanDetail(null)
  }, [planId, subscription, loadPlan])

  function toggleModule(key: OrgModuleKey, on: boolean) {
    setEnabledModules(prev => {
      const next = new Set(prev)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  }

  function toggleExtra(key: BillingExtraKey, on: boolean) {
    setEnabledExtras(prev => {
      const next = new Set(prev)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!planDetail) return

    setSaving(true)
    setErrors({})
    setServerError(null)

    const addons = buildAddons(planDetail, enabledModules)
    const extras = buildExtras(planDetail, enabledExtras)
    const metric_allowances = TRACKED_BILLING_METRICS.map(d => ({
      metric_key: d.key,
      extra_included_quantity: formatAllowanceSubmit(metricExtras[d.key]),
    }))

    const body = isEdit
      ? { plan_id: planId, seats: Number(seats), status, addons, extras, metric_allowances }
      : { org_id: orgId, plan_id: planId, seats: Number(seats), status, addons, extras, metric_allowances }

    try {
      const url = isEdit
        ? `/api/v1/sys-admin/billing/subscriptions/${subscription!.id}`
        : '/api/v1/sys-admin/billing/subscriptions'
      await fetchJson(url, {
        method: isEdit ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      })
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

  const optionalModules = ORG_MODULE_DEFS.filter(d => {
    const pm = planModule(planDetail, d.key)
    return pm && !pm.included
  })

  const optionalExtras = BILLING_EXTRA_DEFS.filter(d => {
    const pe = planExtra(planDetail, d.key)
    return pe && !pe.included
  })

  const includedModules = ORG_MODULE_DEFS.filter(d => planModule(planDetail, d.key)?.included)
  const includedExtras = BILLING_EXTRA_DEFS.filter(d => planExtra(planDetail, d.key)?.included)

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Organización" htmlFor="sub_org" error={errors.org_id?.[0]}>
            <Select
              id="sub_org"
              value={orgId}
              onChange={setOrgId}
              options={orgs.map(o => ({ value: o.id, label: o.name }))}
              placeholder="Seleccionar organización…"
              error={!!errors.org_id}
              disabled={isEdit}
            />
          </FormField>
          <FormField label="Plan" htmlFor="sub_plan" error={errors.plan_id?.[0]}>
            <Select
              id="sub_plan"
              value={planId}
              onChange={setPlanId}
              options={plans.map(p => ({ value: p.id, label: p.name }))}
              placeholder="Seleccionar plan…"
              error={!!errors.plan_id}
            />
          </FormField>
          <FormField
            label="Usuarios contratados"
            htmlFor="sub_seats"
            error={errors.seats?.[0]}
          >
            <Input
              id="sub_seats"
              type="number"
              min={1}
              value={seats}
              onChange={e => setSeats(e.target.value)}
              error={!!errors.seats}
            />
            <p className="text-[11px] text-fg-subtle mt-1">
              Mínimo acordado en el contrato. No es lo mismo que los incluidos en el plan: se factura el mayor entre activos y este número; los extras se cobran solo por encima de lo incluido en el plan.
            </p>
          </FormField>
          <FormField label="Estado" htmlFor="sub_status" error={errors.status?.[0]}>
            <Select
              id="sub_status"
              value={status}
              onChange={v => setStatus(v as SubscriptionStatus)}
              options={isEdit ? [
                { value: 'trialing', label: 'Prueba' },
                { value: 'active', label: 'Activa' },
                { value: 'past_due', label: 'Vencida' },
                { value: 'paused', label: 'Pausada' },
                { value: 'cancelled', label: 'Cancelada' },
              ] : [
                { value: 'trialing', label: 'Prueba' },
                { value: 'active', label: 'Activa' },
              ]}
            />
          </FormField>
        </div>

        {planId && (
          <div className="rounded-md border border-border bg-surface px-4 py-3">
            <h3 className="text-[13px] font-semibold text-fg mb-1">Términos del contrato</h3>
            <p className="text-[12px] text-fg-muted mb-3">
              Módulos y servicios incluidos en el plan, más add-ons opcionales que se facturan en cada período.
            </p>

            {planLoading ? (
              <p className="text-[12px] text-fg-muted">Cargando plan…</p>
            ) : planDetail ? (
              <div className="flex flex-col gap-4">
                {(includedModules.length > 0 || includedExtras.length > 0) && (
                  <div>
                    <p className="text-[12px] font-medium text-fg-muted mb-2">Incluido en el plan</p>
                    <div className="flex flex-wrap gap-1.5">
                      {includedModules.map(d => (
                        <span key={d.key} className="text-[11px] px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                          {d.label}
                        </span>
                      ))}
                      {includedExtras.map(d => (
                        <span key={d.key} className="text-[11px] px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                          {d.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {optionalModules.length > 0 && (
                  <div>
                    <p className="text-[12px] font-medium text-fg-muted mb-2">Módulos add-on</p>
                    <div className="flex flex-col gap-2">
                      {optionalModules.map(d => {
                        const pm = planModule(planDetail, d.key)!
                        return (
                          <label
                            key={d.key}
                            className="flex items-center gap-3 rounded-sm border border-border/60 px-3 py-2 cursor-pointer"
                          >
                            <Checkbox
                              checked={enabledModules.has(d.key)}
                              onCheckedChange={v => toggleModule(d.key, v === true)}
                            />
                            <span className="flex-1 text-[13px] text-fg">{d.label}</span>
                            <span className="text-[12px] tabular-nums text-fg-muted">{formatARS(pm.addon_price)}/mes</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

                {optionalExtras.length > 0 && (
                  <div>
                    <p className="text-[12px] font-medium text-fg-muted mb-2">Servicios extra</p>
                    <div className="flex flex-col gap-2">
                      {optionalExtras.map(d => {
                        const pe = planExtra(planDetail, d.key)!
                        return (
                          <label
                            key={d.key}
                            className="flex items-start gap-3 rounded-sm border border-border/60 px-3 py-2 cursor-pointer"
                          >
                            <Checkbox
                              className="mt-0.5"
                              checked={enabledExtras.has(d.key)}
                              onCheckedChange={v => toggleExtra(d.key, v === true)}
                            />
                            <span className="flex-1 min-w-0">
                              <span className="block text-[13px] text-fg">{d.label}</span>
                              <span className="block text-[11px] text-fg-muted mt-0.5">{d.description}</span>
                            </span>
                            <span className="text-[12px] tabular-nums text-fg-muted shrink-0">{formatARS(pe.addon_price)}/mes</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-[12px] font-medium text-fg-muted mb-2">Consumo incluido</p>
                  <p className="text-[11px] text-fg-subtle mb-2">
                    Lo incluido en el plan más cualquier cupo extra acordado en este contrato. Solo se factura el consumo por encima del total.
                  </p>
                  <div className="flex flex-col gap-2">
                    {TRACKED_BILLING_METRICS.map(d => {
                      const planQty = trimAllowanceDisplay(planMetricIncluded(planDetail, d.key))
                      const planPrice = planMetricUnitPrice(planDetail, d.key)
                      return (
                        <div key={d.key} className="flex items-start gap-3 rounded-sm border border-border/60 px-3 py-2">
                          <span className="flex-1 min-w-0">
                            <span className="block text-[13px] text-fg">{d.label}</span>
                            <span className="block text-[11px] text-fg-muted mt-0.5">
                              {planQty
                                ? `${planQty} ${d.unit_label ?? 'unid.'} incluidos en plan`
                                : 'Sin cupo en plan'}
                              {planPrice && Number(planPrice) > 0 && (
                                <> · {formatARS(planPrice)}/extra</>
                              )}
                            </span>
                          </span>
                          <div className="w-28 shrink-0">
                            <Input
                              type="number"
                              min={0}
                              step="any"
                              value={metricExtras[d.key]}
                              onChange={e => setMetricExtras(prev => ({ ...prev, [d.key]: e.target.value }))}
                              placeholder="Extra"
                              aria-label={`Extra incluido ${d.label}`}
                            />
                            <span className="block text-[10px] text-fg-muted text-right mt-0.5">
                              +{d.unit_label ?? 'unid.'} contrato
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {optionalModules.length === 0 && optionalExtras.length === 0 && includedModules.length === 0 && includedExtras.length === 0 && (
                  <p className="text-[12px] text-fg-muted">Este plan no tiene módulos ni extras configurados.</p>
                )}
              </div>
            ) : (
              <p className="text-[12px] text-danger">No se pudo cargar el plan.</p>
            )}
          </div>
        )}

        {serverError && (
          <p role="alert" className="text-[12px] text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">
            {serverError}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" size="sm" disabled={saving || !orgId || !planId || !planDetail || planLoading}>
            {saving ? 'Guardando…' : isEdit ? 'Guardar contrato' : 'Crear suscripción'}
          </Button>
        </div>
      </div>
    </form>
  )
}

export function SubscriptionModal({ open, onClose, onSaved, subscription }: SubscriptionModalProps) {
  const isEdit = !!subscription
  return (
    <Dialog
      open={open}
      onOpenChange={v => { if (!v) onClose() }}
      title={isEdit ? 'Editar contrato' : 'Nueva suscripción'}
      size="lg"
    >
      {open ? (
        <SubscriptionForm
          key={subscription?.id ?? 'new'}
          subscription={subscription}
          onClose={onClose}
          onSaved={onSaved}
        />
      ) : null}
    </Dialog>
  )
}
