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
import type { AutomationActionOption, ScheduledTaskRow } from './types'

export interface AutomationTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: ScheduledTaskRow | null
  onSaved: () => void
}

const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires'

export function AutomationTaskDialog({ open, onOpenChange, task, onSaved }: AutomationTaskDialogProps) {
  const isEdit = !!task
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [actionType, setActionType] = useState('')
  const [cronExpression, setCronExpression] = useState('')
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE)
  const [payloadJson, setPayloadJson] = useState('{}')
  const [maxConsecutiveFailures, setMaxConsecutiveFailures] = useState('5')
  const [active, setActive] = useState(true)
  const [actions, setActions] = useState<AutomationActionOption[]>([])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setName(task?.name ?? '')
      setDescription(task?.description ?? '')
      setActionType(task?.action_type ?? '')
      setCronExpression(task?.cron_expression ?? '')
      setTimezone(task?.timezone ?? DEFAULT_TIMEZONE)
      setPayloadJson(JSON.stringify(task?.payload ?? {}, null, 2))
      setMaxConsecutiveFailures(String(task?.max_consecutive_failures ?? 5))
      setActive(task ? task.status !== 'paused' : true)
      setErrors({})
      setServerError(null)
    })
  }, [open, task])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetchJson<{ data: AutomationActionOption[] }>('/api/v1/automations/actions')
        if (!cancelled) setActions(res.data ?? [])
      } catch {
        if (!cancelled) setActions([])
      }
    })()
    return () => { cancelled = true }
  }, [open])

  // Preload the org's default timezone for new tasks. Best-effort: if the caller lacks
  // settings:read (or the request otherwise fails), the hardcoded default still applies.
  useEffect(() => {
    if (!open || isEdit) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetchJson<{ organization: { timezone: string } }>('/api/v1/settings/organization')
        if (!cancelled && res.organization?.timezone) setTimezone(res.organization.timezone)
      } catch {
        // Keep the hardcoded default.
      }
    })()
    return () => { cancelled = true }
  }, [open, isEdit])

  async function handleSave() {
    setSaving(true)
    setErrors({})
    setServerError(null)

    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(payloadJson || '{}')
    } catch {
      setErrors({ payload: ['La configuración debe ser JSON válido.'] })
      setSaving(false)
      return
    }

    const parsedMaxFailures = Number(maxConsecutiveFailures)

    const body = {
      name: name.trim(),
      description: description.trim() || null,
      action_type: actionType,
      cron_expression: cronExpression.trim(),
      timezone: timezone.trim() || DEFAULT_TIMEZONE,
      payload,
      // Only fall back to the default when the input isn't a valid number at all
      // (e.g. empty/NaN) — an explicit 0 must reach the backend so its real
      // min(1) validation error surfaces, instead of being silently coerced to 5.
      max_consecutive_failures: Number.isFinite(parsedMaxFailures) ? parsedMaxFailures : 5,
      ...(isEdit ? { status: active ? 'active' : 'paused' } : {}),
    }

    try {
      if (isEdit) {
        await fetchJson(`/api/v1/automations/${task.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      } else {
        await fetchJson('/api/v1/automations', { method: 'POST', body: JSON.stringify(body) })
      }
      notifySuccess(isEdit ? 'Automatización actualizada' : 'Automatización creada')
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

  const canSave = name.trim() && actionType && cronExpression.trim()

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Editar automatización' : 'Nueva automatización'}
      footer={
        <DialogFooter error={serverError}>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !canSave}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label="Nombre" htmlFor="task_name" required error={errors.name?.[0]}>
          <Input id="task_name" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Vencer cotizaciones atrasadas" />
        </FormField>
        <FormField label="Descripción" htmlFor="task_description" error={errors.description?.[0]}>
          <Textarea id="task_description" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
        </FormField>
        <FormField label="Acción" htmlFor="task_action_type" required error={errors.action_type?.[0]}>
          <Select
            id="task_action_type"
            value={actionType}
            onChange={setActionType}
            options={[
              { value: '', label: 'Elegí una acción' },
              ...actions.map(a => ({ value: a.type, label: a.label })),
            ]}
          />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Expresión cron" htmlFor="task_cron" required error={errors.cron_expression?.[0]}>
            <Input
              id="task_cron"
              value={cronExpression}
              onChange={e => setCronExpression(e.target.value)}
              placeholder="0 6 * * *"
              className="font-mono"
            />
          </FormField>
          <FormField label="Zona horaria" htmlFor="task_timezone" error={errors.timezone?.[0]}>
            <Input id="task_timezone" value={timezone} onChange={e => setTimezone(e.target.value)} />
          </FormField>
        </div>
        <FormField label="Configuración (JSON)" htmlFor="task_payload" error={errors.payload?.[0]}>
          <Textarea id="task_payload" value={payloadJson} onChange={e => setPayloadJson(e.target.value)} rows={4} className="font-mono text-[12px]" />
          <p className="text-xs text-fg-subtle">Depende de la acción elegida. Dejá {'{}'} si no requiere parámetros.</p>
        </FormField>
        <FormField label="Máximo de fallos consecutivos antes de pausar" htmlFor="task_max_failures" error={errors.max_consecutive_failures?.[0]}>
          <Input
            id="task_max_failures"
            type="number"
            min={1}
            max={50}
            value={maxConsecutiveFailures}
            onChange={e => setMaxConsecutiveFailures(e.target.value)}
          />
        </FormField>
        {isEdit && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-fg-muted">Activa</span>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        )}
      </div>
    </Dialog>
  )
}
