'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogFooter } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Switch } from '@/components/primitives/Switch'
import { Textarea } from '@/components/primitives/Textarea'
import { CronScheduleFields } from '@/components/erp/CronScheduleFields'
import { HelpBubble } from '@/components/erp/HelpBubble'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifySuccess } from '@/lib/notify'
import { fieldErrorsFromApiError } from '@/lib/validation-errors'
import {
  DEFAULT_CRON_EXPRESSION,
  DEFAULT_CRON_TIMEZONE,
  matchCronPresetId,
} from '@/lib/cron-presets'
import type { AutomationActionOption, ScheduledTaskRow } from './types'

export interface AutomationTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: ScheduledTaskRow | null
  onSaved: () => void
}

const WEBHOOK_ACTION = 'core.webhook_call'
const EXPIRE_QUOTES_ACTION = 'sales.expire_overdue_quotes'

/** Allowed consecutive-failure caps before the task auto-pauses. */
const MAX_FAILURE_OPTIONS = [
  { value: '1', label: '1 — pausar al primer fallo' },
  { value: '3', label: '3 fallos' },
  { value: '5', label: '5 fallos (recomendado)' },
  { value: '10', label: '10 fallos' },
  { value: '20', label: '20 fallos' },
] as const

const MAX_FAILURE_VALUES = MAX_FAILURE_OPTIONS.map(o => Number(o.value))

function snapMaxFailures(value: number): string {
  if (MAX_FAILURE_VALUES.includes(value)) return String(value)
  const nearest = MAX_FAILURE_VALUES.reduce((best, n) =>
    Math.abs(n - value) < Math.abs(best - value) ? n : best,
  )
  return String(nearest)
}

export function AutomationTaskDialog({ open, onOpenChange, task, onSaved }: AutomationTaskDialogProps) {
  const isEdit = !!task
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [actionType, setActionType] = useState('')
  const [cronExpression, setCronExpression] = useState(DEFAULT_CRON_EXPRESSION)
  const [cronPresetId, setCronPresetId] = useState(matchCronPresetId(DEFAULT_CRON_EXPRESSION))
  const [timezone, setTimezone] = useState(DEFAULT_CRON_TIMEZONE)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookMethod, setWebhookMethod] = useState<'GET' | 'POST'>('POST')
  const [webhookBody, setWebhookBody] = useState('')
  const [maxConsecutiveFailures, setMaxConsecutiveFailures] = useState('5')
  const [active, setActive] = useState(true)
  const [actions, setActions] = useState<AutomationActionOption[]>([])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      const cron = task?.cron_expression ?? DEFAULT_CRON_EXPRESSION
      setName(task?.name ?? '')
      setDescription(task?.description ?? '')
      setActionType(task?.action_type ?? '')
      setCronExpression(cron)
      setCronPresetId(matchCronPresetId(cron))
      setTimezone(task?.timezone ?? DEFAULT_CRON_TIMEZONE)
      setMaxConsecutiveFailures(snapMaxFailures(task?.max_consecutive_failures ?? 5))
      setActive(task ? task.status !== 'paused' : true)
      setErrors({})
      setServerError(null)

      const payload = task?.payload ?? {}
      if (task?.action_type === WEBHOOK_ACTION) {
        setWebhookUrl(typeof payload.url === 'string' ? payload.url : '')
        setWebhookMethod(payload.method === 'GET' ? 'GET' : 'POST')
        setWebhookBody(
          payload.body !== undefined ? JSON.stringify(payload.body, null, 2) : '',
        )
      } else {
        setWebhookUrl('')
        setWebhookMethod('POST')
        setWebhookBody('')
      }
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

  function buildPayload(): { ok: true; payload: Record<string, unknown> } | { ok: false; error: string } {
    if (actionType === EXPIRE_QUOTES_ACTION || !actionType) {
      return { ok: true, payload: {} }
    }
    if (actionType === WEBHOOK_ACTION) {
      const url = webhookUrl.trim()
      if (!url) return { ok: false, error: 'La URL del webhook es requerida.' }
      let body: unknown
      if (webhookMethod === 'POST' && webhookBody.trim()) {
        try {
          body = JSON.parse(webhookBody)
        } catch {
          return { ok: false, error: 'El body debe ser JSON válido.' }
        }
      }
      const payload: Record<string, unknown> = { url, method: webhookMethod }
      if (body !== undefined) payload.body = body
      return { ok: true, payload }
    }
    return { ok: true, payload: {} }
  }

  async function handleSave() {
    setSaving(true)
    setErrors({})
    setServerError(null)

    const built = buildPayload()
    if (!built.ok) {
      setErrors({ payload: [built.error] })
      setSaving(false)
      return
    }

    const parsedMaxFailures = Number(maxConsecutiveFailures)

    const body = {
      name: name.trim(),
      description: description.trim() || null,
      action_type: actionType,
      cron_expression: cronExpression.trim(),
      timezone: timezone.trim() || DEFAULT_CRON_TIMEZONE,
      payload: built.payload,
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

        <CronScheduleFields
          cronExpression={cronExpression}
          timezone={timezone}
          presetId={cronPresetId}
          onPresetIdChange={setCronPresetId}
          onCronExpressionChange={setCronExpression}
          onTimezoneChange={setTimezone}
          cronError={errors.cron_expression?.[0]}
          timezoneError={errors.timezone?.[0]}
          cronId="task_cron"
          timezoneId="task_timezone"
        />

        {actionType === WEBHOOK_ACTION && (
          <div className="flex flex-col gap-3">
            <HelpBubble title="¿Qué es llamar a un webhook?" label="Webhook">
              <p>
                Andiko <strong>sale</strong> a llamar una URL HTTPS que vos configurás (Zapier, Make, n8n,
                Slack Incoming Webhook, o una API tuya). No es un webhook entrante de Andiko: no recibimos
                nada; nosotros hacemos el request cuando toca el schedule.
              </p>
              <p>
                Ejemplo: cada mañana POST a tu flujo de Make con un body JSON para avisar o sincronizar
                datos. La URL tiene que ser pública (no localhost ni redes privadas).
              </p>
              <p>
                Si el servidor responde error HTTP o no contesta a tiempo, la corrida se marca como fallida
                y cuenta para el máximo de fallos consecutivos.
              </p>
            </HelpBubble>
            <FormField label="URL del webhook" htmlFor="webhook_url" required error={errors.payload?.[0]}>
              <Input
                id="webhook_url"
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.ejemplo.com/..."
              />
            </FormField>
            <FormField label="Método" htmlFor="webhook_method">
              <Select
                id="webhook_method"
                value={webhookMethod}
                onChange={v => setWebhookMethod(v === 'GET' ? 'GET' : 'POST')}
                options={[
                  { value: 'POST', label: 'POST' },
                  { value: 'GET', label: 'GET' },
                ]}
              />
            </FormField>
            {webhookMethod === 'POST' && (
              <FormField label="Body (JSON, opcional)" htmlFor="webhook_body" error={errors.payload?.[0]}>
                <Textarea
                  id="webhook_body"
                  value={webhookBody}
                  onChange={e => setWebhookBody(e.target.value)}
                  rows={4}
                  className="font-mono text-[12px]"
                  placeholder="{}"
                />
              </FormField>
            )}
          </div>
        )}

        {actionType === EXPIRE_QUOTES_ACTION && (
          <p className="text-xs text-fg-subtle">
            Marca como vencidas las cotizaciones de la organización cuya fecha de validez ya pasó. No requiere configuración adicional.
          </p>
        )}

        <FormField
          label="Máximo de fallos consecutivos antes de pausar"
          htmlFor="task_max_failures"
          error={errors.max_consecutive_failures?.[0]}
        >
          <Select
            id="task_max_failures"
            value={maxConsecutiveFailures}
            onChange={setMaxConsecutiveFailures}
            options={[...MAX_FAILURE_OPTIONS]}
          />
          <p className="text-xs text-fg-subtle mt-1">
            Si la tarea falla seguidas esta cantidad de veces, se pausa sola hasta que la reactives.
          </p>
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
