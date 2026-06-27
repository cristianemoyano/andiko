'use client'

import { useState, useEffect } from 'react'
import { DataTable, type Column } from '@/components/erp'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { FormField } from '@/components/primitives/FormField'
import { Dialog } from '@/components/primitives/Dialog'
import { Select } from '@/components/primitives/Select'
import { Skeleton } from '@/components/primitives/Skeleton'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

export interface UsageRow {
  id: string
  org_id: string | null
  subscription_id: string | null
  metric_key: string
  quantity: string
  period: string
  invoiced_at: string | null
}

interface MetricRef {
  key: string
  label: string
}

interface SubscriptionUsageSectionProps {
  subscriptionId: string
  orgId: string
  /** Increment to reload usage rows (e.g. after manual register). */
  refreshKey?: number
  onUsageChanged?: () => void
}

export function SubscriptionUsageSection({
  subscriptionId,
  orgId,
  refreshKey = 0,
  onUsageChanged,
}: SubscriptionUsageSectionProps) {
  const [rows, setRows] = useState<UsageRow[]>([])
  const [metrics, setMetrics] = useState<MetricRef[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [metricKey, setMetricKey] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!cancelled) setLoading(true)
      try {
        const [usage, metricList] = await Promise.all([
          fetchJson<{ data: UsageRow[] }>(
            `/api/v1/sys-admin/billing/usage?subscription_id=${subscriptionId}&limit=100`,
          ),
          fetchJson<{ data: MetricRef[] }>('/api/v1/sys-admin/billing/metrics?limit=100'),
        ])
        if (cancelled) return
        setRows(usage.data ?? [])
        setMetrics(metricList.data ?? [])
      } catch {
        if (!cancelled) { setRows([]); setMetrics([]) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [subscriptionId, refreshKey])

  const metricLabel = (key: string) => metrics.find(m => m.key === key)?.label ?? key

  const metricOptions = metrics.map(m => ({ value: m.key, label: m.label }))

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await fetchJson('/api/v1/sys-admin/billing/usage', {
        method: 'POST',
        body: JSON.stringify({
          org_id: orgId,
          subscription_id: subscriptionId,
          metric_key: metricKey,
          quantity,
          period,
        }),
      })
      setModalOpen(false)
      onUsageChanged?.()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const columns: Column<UsageRow>[] = [
    { key: 'period', header: 'Período', mobileRole: 'title', render: r => <span className="tabular-nums">{r.period}</span> },
    { key: 'metric', header: 'Métrica', mobileRole: 'subtitle', render: r => <span className="text-fg">{metricLabel(r.metric_key)}</span> },
    { key: 'quantity', header: 'Cantidad', align: 'right', mobileRole: 'amount', render: r => <span className="tabular-nums">{r.quantity}</span> },
    {
      key: 'invoiced',
      header: 'Facturado',
      mobileRole: 'badge',
      render: r => <span className="text-[12px] text-fg-muted">{r.invoiced_at ? 'Sí' : 'Pendiente'}</span>,
    },
  ]

  return (
    <section className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div>
          <h2 className="text-[13px] font-semibold text-fg">Registro de consumo</h2>
          <p className="text-[12px] text-fg-muted mt-0.5">
            Eventos medidos de esta suscripción en el período actual. AFIP se registra automáticamente.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => { setError(null); setModalOpen(true) }}
          disabled={!orgId}
        >
          + Registrar uso
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} shape="block" className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          keyExtractor={r => r.id}
          emptyMessage="Sin consumo registrado en el período."
        />
      )}

      <Dialog open={modalOpen} onOpenChange={v => { if (!v) setModalOpen(false) }} title="Registrar uso manual" size="md">
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <FormField label="Métrica" htmlFor="usage_metric">
            <Select
              id="usage_metric"
              value={metricKey}
              onChange={setMetricKey}
              options={metricOptions}
              placeholder="Seleccionar métrica…"
            />
          </FormField>
          <FormField label="Cantidad" htmlFor="usage_qty">
            <Input id="usage_qty" value={quantity} onChange={e => setQuantity(e.target.value)} required />
          </FormField>
          <FormField label="Período" htmlFor="usage_period">
            <Input id="usage_period" type="date" value={period} onChange={e => setPeriod(e.target.value)} required />
          </FormField>
          {error && (
            <p role="alert" className="text-[12px] text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">{error}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={saving || !metricKey}>{saving ? 'Guardando…' : 'Registrar'}</Button>
          </div>
        </form>
      </Dialog>
    </section>
  )
}
