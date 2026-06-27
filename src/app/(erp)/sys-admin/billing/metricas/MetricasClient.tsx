'use client'

import { useState, useEffect, useMemo } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, type Column } from '@/components/erp'
import { StatusBadge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { FormField } from '@/components/primitives/FormField'
import { Dialog } from '@/components/primitives/Dialog'
import { Skeleton } from '@/components/primitives/Skeleton'
import { BillingSubNav } from '../BillingSubNav'
import {
  buildTrackedMetricsCatalog,
  getTrackedBillingMetric,
  type TrackedBillingMetricStatus,
} from '@/modules/billing/billing-metrics.catalog'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

interface MetricRow {
  id: string
  key: string
  label: string
  unit_label: string | null
  is_active: boolean
}

export function MetricasClient() {
  const [rows, setRows] = useState<MetricRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<MetricRow | null>(null)
  const [key, setKey] = useState('')
  const [label, setLabel] = useState('')
  const [unitLabel, setUnitLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!cancelled) setLoading(true)
      try {
        const metrics = await fetchJson<{ data: MetricRow[] }>('/api/v1/sys-admin/billing/metrics?limit=100')
        if (cancelled) return
        setRows(metrics.data ?? [])
        setError(null)
      } catch (err) {
        if (!cancelled) {
          setRows([])
          setError(getApiErrorMessage(err))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [refresh])

  const configuredKeys = useMemo(() => new Set(rows.map(r => r.key)), [rows])

  const catalog = useMemo(
    () => buildTrackedMetricsCatalog(configuredKeys),
    [configuredKeys],
  )

  const pendingCatalog = useMemo(
    () => catalog.filter(c => !c.configured),
    [catalog],
  )

  const catalogByKey = useMemo(
    () => new Map<string, TrackedBillingMetricStatus>(catalog.map(c => [c.key, c])),
    [catalog],
  )

  function applyCatalogKey(nextKey: string) {
    setKey(nextKey)
    const def = getTrackedBillingMetric(nextKey)
    if (!def) return
    setLabel(def.label)
    setUnitLabel(def.unit_label)
  }

  function openCreate() {
    setEditing(null)
    setError(null)
    setModalOpen(true)
    const first = pendingCatalog[0]
    if (first) applyCatalogKey(first.key)
    else {
      setKey('')
      setLabel('')
      setUnitLabel('')
    }
  }

  function openEdit(row: MetricRow) {
    setEditing(row)
    setKey(row.key)
    setLabel(row.label)
    setUnitLabel(row.unit_label ?? '')
    setError(null)
    setModalOpen(true)
  }

  async function handleSync() {
    setSyncing(true)
    setError(null)
    try {
      await fetchJson('/api/v1/sys-admin/billing/metrics/sync', { method: 'POST' })
      setRefresh(r => r + 1)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setSyncing(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const body = {
        key,
        label,
        unit_label: unitLabel.trim() || null,
        is_active: true,
      }
      if (editing) {
        await fetchJson(`/api/v1/sys-admin/billing/metrics/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ label: body.label, unit_label: body.unit_label }),
        })
      } else {
        await fetchJson('/api/v1/sys-admin/billing/metrics', { method: 'POST', body: JSON.stringify(body) })
      }
      setModalOpen(false)
      setRefresh(r => r + 1)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const columns: Column<MetricRow>[] = [
    { key: 'label', header: 'Métrica', mobileRole: 'title', render: r => <span className="font-medium text-fg">{r.label}</span> },
    { key: 'key', header: 'Clave', mobileRole: 'subtitle', render: r => <span className="font-mono text-[12px] text-fg-muted">{r.key}</span> },
    {
      key: 'tracked_by',
      header: 'Medición',
      mobileRole: 'subtitle',
      render: r => <span className="text-[12px] text-fg-muted">{catalogByKey.get(r.key)?.tracked_by ?? '—'}</span>,
    },
    { key: 'unit_label', header: 'Unidad', mobileRole: 'subtitle', render: r => <span className="text-fg-muted">{r.unit_label ?? '—'}</span> },
    { key: 'is_active', header: 'Estado', mobileRole: 'badge', render: r => <StatusBadge value={r.is_active ? 'Activa' : 'Inactiva'} /> },
    {
      key: '_actions',
      header: '',
      mobileRole: 'actions',
      render: r => <Button variant="ghost" size="xs" onClick={() => openEdit(r)}>Editar</Button>,
    },
  ]

  const createOptions = pendingCatalog.map(c => ({
    value: c.key,
    label: c.label,
  }))

  const selectedCatalog = key ? catalogByKey.get(key) : undefined
  const needsSync = pendingCatalog.length > 0

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Facturación', href: '/sys-admin/billing' }, { label: 'Métricas' }]}
        actions={
          <div className="flex gap-2">
            {needsSync && (
              <Button variant="secondary" size="sm" onClick={handleSync} disabled={syncing || loading}>
                {syncing ? 'Sincronizando…' : 'Sincronizar catálogo'}
              </Button>
            )}
            <Button size="sm" onClick={openCreate} disabled={loading || pendingCatalog.length === 0}>
              + Configurar métrica
            </Button>
          </div>
        }
      />
      <BillingSubNav />
      <PageBody>
        <p className="text-[13px] text-fg-muted mb-4 rounded-md border border-border bg-surface px-4 py-3">
          Catálogo de <strong className="font-medium text-fg">qué se mide</strong> en el ERP (AFIP, POS, storage).
          Acá activás métricas y definís etiquetas; el <strong className="font-medium text-fg">precio por unidad</strong> se configura en cada{' '}
          <strong className="font-medium text-fg">plan</strong>, junto con el cupo incluido.
        </p>

        {error && !modalOpen && (
          <p role="alert" className="text-[12px] text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2 mb-4">{error}</p>
        )}

        {!loading && rows.length === 0 && (
          <div className="mb-4 rounded-md border border-border bg-surface-muted px-4 py-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-medium text-fg">Sin métricas configuradas</p>
              <p className="text-[13px] text-fg-muted mt-1">
                Sincronizá el catálogo del sistema para activar las {catalog.length} métricas trackeadas.
              </p>
            </div>
            <Button size="sm" onClick={handleSync} disabled={syncing}>
              {syncing ? 'Sincronizando…' : 'Sincronizar catálogo'}
            </Button>
          </div>
        )}

        {needsSync && rows.length > 0 && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">
            <p className="font-medium">Métricas del sistema sin configurar ({pendingCatalog.length})</p>
            <p className="mt-1 text-amber-900/90">
              {pendingCatalog.map(c => c.label).join(' · ')} — usá «Sincronizar catálogo» o «Configurar métrica».
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} shape="block" className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <DataTable columns={columns} data={rows} keyExtractor={r => r.id} emptyMessage="No hay métricas en la tabla. Usá el botón de arriba para sincronizar." />
        )}

        {!loading && (
          <section className="mt-6">
            <h2 className="text-[13px] font-semibold text-fg mb-2">Catálogo del sistema</h2>
            <ul className="rounded-md border border-border divide-y divide-border">
              {catalog.map(c => (
                <li key={c.key} className="px-4 py-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-fg">{c.label}</p>
                    <p className="text-[12px] font-mono text-fg-muted mt-0.5">{c.key}</p>
                    <p className="text-[12px] text-fg-muted mt-1">{c.description}</p>
                    <p className="text-[12px] text-fg-muted mt-0.5">{c.tracked_by}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {c.configured ? (
                      <StatusBadge value="Configurada" />
                    ) : (
                      <span className="text-[12px] text-fg-muted">Pendiente de activar</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </PageBody>

      <Dialog open={modalOpen} onOpenChange={v => { if (!v) setModalOpen(false) }} title={editing ? 'Editar métrica' : 'Configurar métrica'} size="md">
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {!editing && (
            <FormField label="Métrica del sistema" htmlFor="metric_key">
              <Select
                id="metric_key"
                value={key}
                onChange={applyCatalogKey}
                options={createOptions}
                placeholder="Elegí una métrica"
              />
            </FormField>
          )}
          {editing && (
            <FormField label="Clave" htmlFor="metric_key_readonly">
              <Input id="metric_key_readonly" value={key} disabled />
            </FormField>
          )}
          {selectedCatalog && !editing && (
            <p className="text-[12px] text-fg-muted -mt-2">{selectedCatalog.description} · {selectedCatalog.tracked_by}</p>
          )}
          <FormField label="Etiqueta en factura" htmlFor="metric_label">
            <Input id="metric_label" value={label} onChange={e => setLabel(e.target.value)} required />
          </FormField>
          <FormField label="Unidad" htmlFor="metric_unit">
            <Input id="metric_unit" value={unitLabel} onChange={e => setUnitLabel(e.target.value)} />
          </FormField>
          <p className="text-[12px] text-fg-muted -mt-2">
            El precio por unidad excedente se define en cada plan (sección «Consumo medido»).
          </p>
          {error && (
            <p role="alert" className="text-[12px] text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">{error}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={saving || (!editing && !key)}>{saving ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
