'use client'

import { useState, useEffect } from 'react'
import { Dialog } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { FormField } from '@/components/primitives/FormField'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { fieldErrorsFromApiError } from '@/lib/validation-errors'

interface SubscriptionModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

type FieldErrors = Record<string, string[]>

interface OrgRef { id: string; name: string }
interface PlanRef { id: string; name: string }

export function SubscriptionModal({ open, onClose, onSaved }: SubscriptionModalProps) {
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)

  const [orgs, setOrgs] = useState<OrgRef[]>([])
  const [plans, setPlans] = useState<PlanRef[]>([])
  const [orgId, setOrgId] = useState('')
  const [planId, setPlanId] = useState('')
  const [seats, setSeats] = useState('1')
  const [status, setStatus] = useState('trialing')

  useEffect(() => {
    if (!open) return
    void (async () => {
      try {
        const [o, p] = await Promise.all([
          fetchJson<{ data: OrgRef[] }>('/api/v1/sys-admin/organizations'),
          fetchJson<{ data: PlanRef[] }>('/api/v1/sys-admin/billing/plans?is_active=true&limit=100'),
        ])
        setOrgs(o.data ?? [])
        setPlans(p.data ?? [])
      } catch {
        setOrgs([])
        setPlans([])
      }
    })()
  }, [open])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    setServerError(null)

    try {
      await fetchJson('/api/v1/sys-admin/billing/subscriptions', {
        method: 'POST',
        body: JSON.stringify({ org_id: orgId, plan_id: planId, seats: Number(seats), status }),
      })
      setOrgId(''); setPlanId(''); setSeats('1'); setStatus('trialing')
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

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }} title="Nueva suscripción" size="md">
      <form onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-4">
          <FormField label="Organización" htmlFor="sub_org" error={errors.org_id?.[0]}>
            <Select
              id="sub_org"
              value={orgId}
              onChange={setOrgId}
              options={orgs.map(o => ({ value: o.id, label: o.name }))}
              placeholder="Seleccionar organización…"
              error={!!errors.org_id}
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
          <FormField label="Usuarios (asientos)" htmlFor="sub_seats" error={errors.seats?.[0]}>
            <Input
              id="sub_seats"
              type="number"
              min={1}
              value={seats}
              onChange={e => setSeats(e.target.value)}
              error={!!errors.seats}
            />
          </FormField>
          <FormField label="Estado inicial" htmlFor="sub_status" error={errors.status?.[0]}>
            <Select
              id="sub_status"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'trialing', label: 'Prueba' },
                { value: 'active', label: 'Activa' },
              ]}
            />
          </FormField>
          {serverError && (
            <p role="alert" className="text-[12px] text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">
              {serverError}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={saving || !orgId || !planId}>
              {saving ? 'Creando…' : 'Crear'}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  )
}
