'use client'

import { useEffect, useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { Button } from '@/components/primitives/Button'
import { Switch } from '@/components/primitives/Switch'
import { CronScheduleFields } from '@/components/erp/CronScheduleFields'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifySuccess } from '@/lib/notify'
import { matchCronPresetId } from '@/lib/cron-presets'
import { BillingSubNav } from '../BillingSubNav'

interface BillingAutomationPublic {
  enabled: boolean
  cron_expression: string
  timezone: string
  last_run_at: string | null
  last_run_status: 'success' | 'failed' | 'skipped' | null
  last_run_summary: Record<string, unknown> | null
  next_run_at: string | null
  due_preview: {
    active_subscriptions: number
    due_subscriptions: number
    next_period_end: string | null
  }
}

const ENDPOINT = '/api/v1/sys-admin/billing/automation'

function formatTs(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function formatDateOnly(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'medium',
      timeZone: 'UTC',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

const STATUS_LABEL: Record<string, string> = {
  success: 'Éxito',
  failed: 'Falló',
  skipped: 'Omitido',
}

function runResultMessage(result: {
  generated: number
  failed: number
  examined: number
  active_subscriptions?: number
  next_period_end?: string | null
}): string {
  if (result.examined === 0) {
    const active = result.active_subscriptions ?? 0
    const next = result.next_period_end ? formatDateOnly(result.next_period_end) : null
    if (active === 0) {
      return 'No hay suscripciones activas para facturar.'
    }
    return next
      ? `Ninguna con periodo vencido (${active} activa(s); el próximo periodo cierra el ${next}).`
      : `Ninguna con periodo vencido (${active} activa(s)).`
  }
  return `Corrida: ${result.generated} generada(s), ${result.failed} fallida(s) de ${result.examined} con periodo vencido.`
}

export function AutomationClient() {
  const [data, setData] = useState<BillingAutomationPublic | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [cronExpression, setCronExpression] = useState('0 5 * * *')
  const [cronPresetId, setCronPresetId] = useState(matchCronPresetId('0 5 * * *'))
  const [timezone, setTimezone] = useState('America/Argentina/Buenos_Aires')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [confirmRun, setConfirmRun] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setServerError(null)
      try {
        const body = await fetchJson<BillingAutomationPublic>(ENDPOINT)
        if (cancelled) return
        setData(body)
        setEnabled(body.enabled)
        setCronExpression(body.cron_expression)
        setCronPresetId(matchCronPresetId(body.cron_expression))
        setTimezone(body.timezone)
      } catch (e) {
        if (!cancelled) setServerError(getApiErrorMessage(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [refresh])

  async function handleSave() {
    setSaving(true)
    setServerError(null)
    try {
      const body = await fetchJson<BillingAutomationPublic>(ENDPOINT, {
        method: 'PATCH',
        body: JSON.stringify({
          enabled,
          cron_expression: cronExpression.trim(),
          timezone: timezone.trim(),
        }),
      })
      setData(body)
      notifySuccess('Automatización de facturación guardada')
      setRefresh(r => r + 1)
    } catch (e) {
      setServerError(getApiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleRunNow() {
    setRunning(true)
    setServerError(null)
    try {
      const res = await fetchJson<{
        ok: boolean
        result: {
          generated: number
          failed: number
          examined: number
          active_subscriptions: number
          next_period_end: string | null
        }
        settings: BillingAutomationPublic
      }>(`${ENDPOINT}/run`, { method: 'POST' })
      setData(res.settings)
      notifySuccess(runResultMessage(res.result))
      setRefresh(r => r + 1)
    } catch (e) {
      setServerError(getApiErrorMessage(e))
    } finally {
      setRunning(false)
    }
  }

  const summary = data?.last_run_summary
  const summaryText = summary
    ? Number(summary.examined) === 0
      ? runResultMessage({
          generated: Number(summary.generated ?? 0),
          failed: Number(summary.failed ?? 0),
          examined: 0,
          active_subscriptions: Number(summary.active_subscriptions ?? 0),
          next_period_end: typeof summary.next_period_end === 'string' ? summary.next_period_end : null,
        })
      : `generadas=${String(summary.generated ?? '—')} fallidas=${String(summary.failed ?? '—')} revisadas=${String(summary.examined ?? '—')}`
    : null

  const preview = data?.due_preview

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Facturación', href: '/sys-admin/billing' },
          { label: 'Automatización' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirmRun(true)}
              disabled={loading || running || saving}
            >
              {running ? 'Ejecutando…' : 'Ejecutar ahora'}
            </Button>
            <Button type="button" onClick={handleSave} disabled={loading || saving || !cronExpression.trim()}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        }
      />

      <BillingSubNav />

      <PageBody>
        {serverError && (
          <p className="text-sm text-danger mb-4" role="alert">{serverError}</p>
        )}

        {loading || !data ? (
          <p className="text-sm text-fg-muted">Cargando…</p>
        ) : (
          <div className="max-w-xl flex flex-col gap-6">
            <p className="text-sm text-fg-muted">
              Genera facturas draft solo cuando el <strong>periodo de la suscripción ya venció</strong>
              {' '}(<code className="text-[11px]">current_period_end ≤ ahora</code>). No factura el mes
              en curso a mitad de periodo. Los gerentes no ven esto en Automatizaciones del ERP.
            </p>

            {preview && (
              <div className="rounded-md border border-border bg-surface-muted px-4 py-3 text-sm">
                <p className="font-medium text-fg">Estado actual</p>
                <p className="text-fg-muted mt-1">
                  {preview.due_subscriptions > 0
                    ? `${preview.due_subscriptions} de ${preview.active_subscriptions} suscripción(es) con periodo vencido — se facturarían al ejecutar.`
                    : preview.active_subscriptions > 0
                      ? `0 de ${preview.active_subscriptions} con periodo vencido. Próximo cierre: ${formatDateOnly(preview.next_period_end)}.`
                      : 'No hay suscripciones activas.'}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-4 py-3">
              <div>
                <p className="text-sm font-medium text-fg">Activa</p>
                <p className="text-xs text-fg-subtle">
                  Si está pausada, el cron de producción no genera facturas.
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <CronScheduleFields
              cronExpression={cronExpression}
              timezone={timezone}
              presetId={cronPresetId}
              onPresetIdChange={setCronPresetId}
              onCronExpressionChange={setCronExpression}
              onTimezoneChange={setTimezone}
              cronId="billing_cron"
              timezoneId="billing_timezone"
            />

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border border-border bg-surface px-3 py-2">
                <dt className="text-xs text-fg-subtle">Próxima ejecución</dt>
                <dd className="font-medium text-fg">{formatTs(data.next_run_at)}</dd>
              </div>
              <div className="rounded-md border border-border bg-surface px-3 py-2">
                <dt className="text-xs text-fg-subtle">Última ejecución</dt>
                <dd className="font-medium text-fg">
                  {formatTs(data.last_run_at)}
                  {data.last_run_status
                    ? ` · ${STATUS_LABEL[data.last_run_status] ?? data.last_run_status}`
                    : ''}
                </dd>
              </div>
              {summaryText && (
                <div className="sm:col-span-2 rounded-md border border-border bg-surface px-3 py-2">
                  <dt className="text-xs text-fg-subtle">Resumen última corrida</dt>
                  <dd className="text-xs text-fg">{summaryText}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </PageBody>

      <ConfirmDialog
        open={confirmRun}
        onOpenChange={setConfirmRun}
        title="Ejecutar generación ahora"
        description={
          preview && preview.due_subscriptions === 0
            ? `Hoy no hay periodos vencidos${preview.next_period_end ? ` (próximo cierre ${formatDateOnly(preview.next_period_end)})` : ''}. Igual podés correrla: el resultado será 0 facturas.`
            : 'Se generarán facturas draft para suscripciones activas con periodo vencido. ¿Continuar?'
        }
        variant="warning"
        confirmLabel="Ejecutar"
        onConfirm={handleRunNow}
      />
    </div>
  )
}
