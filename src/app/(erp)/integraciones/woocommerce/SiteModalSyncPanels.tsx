'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/primitives/Button'
import { Badge } from '@/components/primitives/Badge'
import { Switch } from '@/components/primitives/Switch'
import { Select } from '@/components/primitives/Select'
import { FormField } from '@/components/primitives/FormField'
import { StreamProgressPanel } from '@/components/erp/StreamProgressPanel'
import { fetchJson, getApiErrorMessage, isApiRequestError } from '@/lib/fetch-json'
import { formatImportEtaRemaining } from '@/lib/import-progress'
import { TablePagination } from '@/components/erp/TablePagination'
import { useWooAsyncRun } from './useWooAsyncRun'
import type {
  WooSiteRow,
  ImportPreview,
  ImportPreviewSection,
  OrderImportPreview,
  OrderImportPreviewSection,
  CatalogPublishStatus,
  CustomerImportPreview,
  CustomerImportPreviewSection,
  CustomerPushResult,
} from './types'

const PREVIEW_PAGE_SIZE = 20

const ORDER_PREVIEW_SECTION_OPTIONS: { value: OrderImportPreviewSection; label: string }[] = [
  { value: 'to_import', label: 'A importar' },
  { value: 'already_imported', label: 'Ya importados en Andiko' },
  { value: 'skipped', label: 'Excluidos del backfill' },
]

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  processing: 'Procesando',
  'on-hold': 'En espera',
  completed: 'Completado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
  failed: 'Fallido',
  trash: 'Eliminado',
}

function formatOrderPreviewDate(value: string | null): string {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return value
  }
}

function formatOrderPreviewTotal(value: string | null): string {
  if (!value) return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return value
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

const CUSTOMER_PREVIEW_SECTION_OPTIONS: { value: CustomerImportPreviewSection; label: string }[] = [
  { value: 'to_import', label: 'A importar (nuevos en Andiko)' },
  { value: 'matched_by_email', label: 'Vincular por email existente' },
  { value: 'already_linked', label: 'Ya vinculados' },
  { value: 'skipped', label: 'Excluidos (sin email)' },
]

const PREVIEW_SECTION_OPTIONS: { value: ImportPreviewSection; label: string }[] = [
  { value: 'needs_mapping', label: 'Excluidos (sin SKU o duplicado)' },
  { value: 'matched', label: 'Coinciden por SKU' },
  { value: 'to_import', label: 'A importar (solo en Woo)' },
]

const EXCLUDED_PRODUCTS_HELP = (
  <>
    Andiko vincula catálogo, stock y líneas de pedido <strong>por SKU</strong>. Los productos sin SKU o con el mismo SKU
    repetido en WooCommerce <strong>no entran en la importación automática</strong>: importarlos sin una clave única
    podría duplicar artículos o enlazar stock y pedidos al producto equivocado.
    {' '}
    Asigná un SKU único en Woo (o creá la variante en el ERP con ese SKU) y volvé a ejecutar la vista previa.
  </>
)

function SyncDisabledNotice() {
  return (
    <p className="text-[13px] text-fg-muted border border-dashed border-border rounded-sm p-4">
      Completá y guardá la conexión en las pestañas Conexión y Catálogo. Después podés usar la importación inicial acá.
    </p>
  )
}

function SyncSection({
  mode,
  title,
  children,
}: {
  mode: 'automatico' | 'importacion' | 'proximamente'
  title: string
  children: React.ReactNode
}) {
  const label = mode === 'automatico' ? 'Automático' : mode === 'importacion' ? 'Importación inicial' : 'Próximamente'
  const status = mode === 'automatico' ? 'info' as const : mode === 'importacion' ? 'pending' as const : 'neutral' as const

  return (
    <section className="flex flex-col gap-2.5 rounded-sm border border-border bg-surface/50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge status={status}>{label}</Badge>
        <h3 className="text-[13px] font-medium text-fg">{title}</h3>
      </div>
      {children}
    </section>
  )
}

function formatSyncedAt(value: string | null): string {
  if (!value) return 'Todavía no'
  try {
    return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return value
  }
}

function importRunEndpoint(siteId: string) {
  return `/api/v1/integrations/woocommerce/sites/${siteId}/import/run`
}

function WooImportRunPanel({
  run,
  title,
  hint,
  cancelLabel,
  completeMessage,
  cancelledMessage,
}: {
  run: ReturnType<typeof useWooAsyncRun>
  title: string
  hint: string
  cancelLabel: string
  completeMessage?: string | null
  cancelledMessage?: string | null
}) {
  return (
    <>
      {run.running && (
        <StreamProgressPanel
          title={run.progress && run.progress.total > 0 ? title : 'Encolando importación…'}
          unitLabel={run.unitLabel}
          processed={run.progress?.processed ?? 0}
          total={run.progress?.total ?? 0}
          eta={run.eta}
          hint={run.progress && run.progress.total > 0 ? hint : 'Preparando la cola en el servidor.'}
          onCancel={run.cancel}
          cancelLabel={cancelLabel}
        />
      )}
      {completeMessage && !run.running && !run.cancelled && (
        <p className="text-[12px] text-success bg-success-bg border border-success rounded-sm px-3 py-2">
          {completeMessage}
        </p>
      )}
      {run.cancelled && cancelledMessage && (
        <p className="text-[12px] text-warning bg-warning-bg border border-warning rounded-sm px-3 py-2">
          {cancelledMessage}
        </p>
      )}
    </>
  )
}

function formatImportCompleteMessage(run: ReturnType<typeof useWooAsyncRun>, label: string): string | null {
  if (run.running || run.cancelled) return null
  if (!run.progress) return null
  if (run.progress.total === 0) return `No hay ${label} para importar.`
  const processed = run.progress.processed.toLocaleString('es-AR')
  const failed = run.failed > 0 ? ` · ${run.failed.toLocaleString('es-AR')} con error` : ''
  return `Importados ${processed} ${label}${failed}.`
}

function formatImportCancelledMessage(run: ReturnType<typeof useWooAsyncRun>, label: string): string | null {
  if (!run.cancelled || !run.progress) return null
  const processed = run.progress.processed.toLocaleString('es-AR')
  const failed = run.failed > 0 ? ` · ${run.failed.toLocaleString('es-AR')} con error` : ''
  return `Importación cancelada. Procesados ${processed} ${label} antes de detener${failed}.`
}

function useImportPreview(site: WooSiteRow | null) {
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadPreview(opts: {
    section?: ImportPreviewSection
    page?: number
    refresh?: boolean
  } = {}) {
    if (!site) return
    setLoading(true)
    setError(null)
    try {
      setPreview(await fetchJson<ImportPreview>(
        `/api/v1/integrations/woocommerce/sites/${site.id}/import/preview`,
        {
          method: 'POST',
          body: JSON.stringify({
            section: opts.section ?? preview?.section ?? 'needs_mapping',
            page: opts.page ?? 1,
            limit: PREVIEW_PAGE_SIZE,
            refresh: opts.refresh ?? false,
          }),
        },
      ))
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function runPreview() {
    await loadPreview({ page: 1, refresh: true })
  }

  return { preview, loading, error, setError, runPreview, loadPreview }
}

function useOrderImportPreview(site: WooSiteRow | null, openOrdersOnly: boolean) {
  const [preview, setPreview] = useState<OrderImportPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadPreview(opts: {
    section?: OrderImportPreviewSection
    page?: number
    refresh?: boolean
    openOrdersOnly?: boolean
  } = {}) {
    if (!site) return
    setLoading(true)
    setError(null)
    try {
      setPreview(await fetchJson<OrderImportPreview>(
        `/api/v1/integrations/woocommerce/sites/${site.id}/import/orders/preview`,
        {
          method: 'POST',
          body: JSON.stringify({
            open_orders_only: opts.openOrdersOnly ?? openOrdersOnly,
            section: opts.section ?? preview?.section ?? 'to_import',
            page: opts.page ?? 1,
            limit: PREVIEW_PAGE_SIZE,
            refresh: opts.refresh ?? false,
          }),
        },
      ))
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function runPreview() {
    await loadPreview({ page: 1, refresh: true, openOrdersOnly })
  }

  return { preview, loading, error, setError, runPreview, loadPreview }
}

function useCustomerImportPreview(site: WooSiteRow | null) {
  const [preview, setPreview] = useState<CustomerImportPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadPreview(opts: {
    section?: CustomerImportPreviewSection
    page?: number
    refresh?: boolean
  } = {}) {
    if (!site) return
    setLoading(true)
    setError(null)
    try {
      setPreview(await fetchJson<CustomerImportPreview>(
        `/api/v1/integrations/woocommerce/sites/${site.id}/import/customers/preview`,
        {
          method: 'POST',
          body: JSON.stringify({
            section: opts.section ?? preview?.section ?? 'to_import',
            page: opts.page ?? 1,
            limit: PREVIEW_PAGE_SIZE,
            refresh: opts.refresh ?? false,
          }),
        },
      ))
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function runPreview() {
    await loadPreview({ page: 1, refresh: true })
  }

  return { preview, loading, error, setError, runPreview, loadPreview }
}

function OrderImportPreviewBlock({
  preview,
  loading,
  onSectionChange,
  onPageChange,
}: {
  preview: OrderImportPreview
  loading: boolean
  onSectionChange: (section: OrderImportPreviewSection) => void
  onPageChange: (page: number) => void
}) {
  const sectionLabel = ORDER_PREVIEW_SECTION_OPTIONS.find((o) => o.value === preview.section)?.label ?? preview.section

  return (
    <div className="text-[13px] border border-border rounded-sm p-3 flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        <div>En Woo ({preview.open_orders_only ? 'abiertos' : 'todos'}): <strong>{preview.fetched_total}</strong></div>
        <div>A importar: <strong>{preview.to_import_count}</strong></div>
        <div>Ya en Andiko: <strong>{preview.already_imported_count}</strong></div>
        <div>Excluidos: <strong>{preview.skipped_count}</strong></div>
      </div>

      <p className="text-[11px] text-fg-muted leading-snug">
        {preview.open_orders_only
          ? 'Solo pedidos abiertos (pendiente, procesando, en espera). Al importar se descuenta stock.'
          : 'Incluye pedidos abiertos y completados. Cancelados/reembolsados aparecen como excluidos.'}
      </p>

      <FormField label="Detalle paginado" htmlFor="woo_order_preview_section">
        <Select
          id="woo_order_preview_section"
          value={preview.section}
          onChange={(value) => onSectionChange(value as OrderImportPreviewSection)}
          options={ORDER_PREVIEW_SECTION_OPTIONS}
          disabled={loading}
        />
      </FormField>

      {preview.total === 0 ? (
        <p className="text-[12px] text-fg-muted">No hay pedidos en «{sectionLabel}».</p>
      ) : (
        <>
          <ul className="list-disc pl-5 text-fg-muted flex flex-col gap-0.5 max-h-48 overflow-y-auto">
            {preview.items.map((order) => (
              <li key={order.woo_order_id}>
                #{order.number} · {ORDER_STATUS_LABELS[order.status] ?? order.status} · {formatOrderPreviewTotal(order.total)} · {order.customer} · {formatOrderPreviewDate(order.date)}
              </li>
            ))}
          </ul>
          <TablePagination
            page={preview.page}
            pageSize={preview.limit}
            total={preview.total}
            onPageChange={onPageChange}
          />
        </>
      )}
    </div>
  )
}

function CustomerImportPreviewBlock({
  preview,
  loading,
  onSectionChange,
  onPageChange,
}: {
  preview: CustomerImportPreview
  loading: boolean
  onSectionChange: (section: CustomerImportPreviewSection) => void
  onPageChange: (page: number) => void
}) {
  const sectionLabel = CUSTOMER_PREVIEW_SECTION_OPTIONS.find((o) => o.value === preview.section)?.label ?? preview.section

  return (
    <div className="text-[13px] border border-border rounded-sm p-3 flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        <div>En WooCommerce: <strong>{preview.woo_total}</strong></div>
        <div>A importar: <strong>{preview.to_import_count}</strong></div>
        <div>Por email: <strong>{preview.matched_by_email_count}</strong></div>
        <div>Ya vinculados: <strong>{preview.already_linked_count}</strong></div>
      </div>

      <p className="text-[11px] text-fg-muted leading-snug">
        Solo entran clientes registrados en WooCommerce con email. Los invitados de checkout sin cuenta aparecen al importar pedidos, no acá.
        {preview.skipped_count > 0 ? ` Excluidos sin email: ${preview.skipped_count}.` : null}
      </p>

      <FormField label="Detalle paginado" htmlFor="woo_customer_preview_section">
        <Select
          id="woo_customer_preview_section"
          value={preview.section}
          onChange={(value) => onSectionChange(value as CustomerImportPreviewSection)}
          options={CUSTOMER_PREVIEW_SECTION_OPTIONS}
          disabled={loading}
        />
      </FormField>

      {preview.total === 0 ? (
        <p className="text-[12px] text-fg-muted">No hay clientes en «{sectionLabel}».</p>
      ) : (
        <>
          <ul className="list-disc pl-5 text-fg-muted flex flex-col gap-0.5 max-h-48 overflow-y-auto">
            {preview.items.map((customer) => (
              <li key={customer.woo_customer_id}>
                {customer.name}{customer.email ? ` · ${customer.email}` : ''}
              </li>
            ))}
          </ul>
          <TablePagination
            page={preview.page}
            pageSize={preview.limit}
            total={preview.total}
            onPageChange={onPageChange}
          />
        </>
      )}
    </div>
  )
}

function ImportPreviewBlock({
  preview,
  loading,
  onSectionChange,
  onPageChange,
}: {
  preview: ImportPreview
  loading: boolean
  onSectionChange: (section: ImportPreviewSection) => void
  onPageChange: (page: number) => void
}) {
  const sectionLabel = PREVIEW_SECTION_OPTIONS.find((o) => o.value === preview.section)?.label ?? preview.section

  return (
    <div className="text-[13px] border border-border rounded-sm p-3 flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        <div>Total en WooCommerce: <strong>{preview.woo_total}</strong></div>
        <div>Coinciden por SKU: <strong>{preview.matched_count}</strong></div>
        <div>A importar (solo en Woo): <strong>{preview.to_import_count}</strong></div>
        <div>Excluidos del backfill: <strong>{preview.needs_mapping_count}</strong></div>
      </div>

      {preview.needs_mapping_count > 0 && (
        <p className="text-[11px] text-fg-muted leading-snug border-l-2 border-border pl-2.5">
          {EXCLUDED_PRODUCTS_HELP}
        </p>
      )}

      <FormField label="Detalle paginado" htmlFor="woo_preview_section">
        <Select
          id="woo_preview_section"
          value={preview.section}
          onChange={(value) => onSectionChange(value as ImportPreviewSection)}
          options={PREVIEW_SECTION_OPTIONS}
          disabled={loading}
        />
      </FormField>

      {preview.total === 0 ? (
        <p className="text-[12px] text-fg-muted">No hay productos en «{sectionLabel}».</p>
      ) : (
        <>
          <ul className="list-disc pl-5 text-fg-muted flex flex-col gap-0.5 max-h-48 overflow-y-auto">
            {preview.section === 'needs_mapping'
              ? (preview.items as { name: string; reason: string }[]).map((m, i) => (
                  <li key={`${m.name}-${i}`}>{m.name} — {m.reason}</li>
                ))
              : (preview.items as { sku: string; name: string }[]).map((m) => (
                  <li key={m.sku}>{m.sku} — {m.name}</li>
                ))}
          </ul>
          <TablePagination
            page={preview.page}
            pageSize={preview.limit}
            total={preview.total}
            onPageChange={onPageChange}
          />
        </>
      )}
    </div>
  )
}

interface WooProductsSyncPanelProps {
  site: WooSiteRow | null
  onApplied: () => void
}

interface PublishResult {
  published: number
  skipped: number
  failed: number
}

export function WooProductsSyncPanel({ site, onApplied }: WooProductsSyncPanelProps) {
  const siteId = site?.id ?? null
  const { preview, loading, error, setError, runPreview, loadPreview } = useImportPreview(site)
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null)
  const [publishCancelled, setPublishCancelled] = useState(false)
  const [publishProgress, setPublishProgress] = useState<{ processed: number; total: number } | null>(null)
  const [publishEta, setPublishEta] = useState<string | null>(null)
  const publishStartedAtRef = useRef<number | null>(null)
  const publishPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const publishTickInFlightRef = useRef(false)
  const [importUnmatched, setImportUnmatched] = useState(true)
  const [baseline, setBaseline] = useState('none')

  const importRun = useWooAsyncRun({
    siteId,
    endpoint: siteId ? importRunEndpoint(siteId) : '',
    unitLabel: 'productos',
    buildStartBody: () => ({
      scope: 'products',
      import_unmatched_products: importUnmatched,
      stock_baseline: baseline,
      open_orders_only: true,
    }),
    onComplete: onApplied,
    onError: setError,
  })

  function updatePublishProgress(processed: number, total: number) {
    setPublishProgress({ processed, total })
    const startedAt = publishStartedAtRef.current
    if (startedAt != null && total > 0) {
      setPublishEta(formatImportEtaRemaining(processed, total, Date.now() - startedAt))
    }
  }

  function stopPublishPoll() {
    if (publishPollRef.current) {
      clearInterval(publishPollRef.current)
      publishPollRef.current = null
    }
  }

  function applyPublishStatus(status: CatalogPublishStatus) {
    if (status.status === 'running' || status.total > 0) {
      updatePublishProgress(status.processed, status.total)
    }
    if (status.status === 'completed') {
      setPublishResult({ published: status.processed, skipped: 0, failed: status.failed })
      setPublishing(false)
      stopPublishPoll()
      publishStartedAtRef.current = null
      setPublishEta(null)
      onApplied()
    } else if (status.status === 'cancelled') {
      setPublishCancelled(true)
      setPublishResult({ published: status.processed, skipped: 0, failed: status.failed })
      setPublishing(false)
      stopPublishPoll()
      publishStartedAtRef.current = null
      setPublishEta(null)
    } else if (status.status === 'running') {
      setPublishing(true)
    }
  }

  async function tickPublish() {
    if (!siteId || publishTickInFlightRef.current) return
    publishTickInFlightRef.current = true
    try {
      const status = await fetchJson<CatalogPublishStatus>(
        `/api/v1/integrations/woocommerce/sites/${siteId}/publish`,
        { method: 'POST', body: JSON.stringify({ action: 'tick' }) },
      )
      applyPublishStatus(status)
    } catch (err) {
      if (isApiRequestError(err) && (err.status === 404 || err.code === 'SITE_NOT_FOUND')) {
        stopPublishPoll()
        setPublishing(false)
        setError('El sitio ya no existe. Actualizá la lista de sitios.')
        return
      }
      setError(getApiErrorMessage(err))
    } finally {
      publishTickInFlightRef.current = false
    }
  }

  function startPublishPoll() {
    stopPublishPoll()
    void tickPublish()
    publishPollRef.current = setInterval(() => void tickPublish(), 1500)
  }

  async function runPublish() {
    if (!siteId) return
    setPublishing(true)
    setPublishCancelled(false)
    setError(null)
    setPublishResult(null)
    publishStartedAtRef.current = Date.now()
    updatePublishProgress(0, 0)

    try {
      const status = await fetchJson<CatalogPublishStatus>(
        `/api/v1/integrations/woocommerce/sites/${siteId}/publish`,
        { method: 'POST', body: JSON.stringify({}) },
      )
      if (status.total === 0) {
        setPublishResult({ published: 0, skipped: 0, failed: 0 })
        setPublishing(false)
        publishStartedAtRef.current = null
        setPublishProgress(null)
        setPublishEta(null)
        return
      }
      applyPublishStatus(status)
      startPublishPoll()
    } catch (err) {
      setError(getApiErrorMessage(err))
      setPublishing(false)
      publishStartedAtRef.current = null
      setPublishProgress(null)
      setPublishEta(null)
    }
  }

  async function cancelPublish() {
    if (!siteId) return
    stopPublishPoll()
    publishTickInFlightRef.current = true
    setPublishing(false)
    setPublishCancelled(true)
    try {
      const status = await fetchJson<CatalogPublishStatus>(
        `/api/v1/integrations/woocommerce/sites/${siteId}/publish`,
        { method: 'POST', body: JSON.stringify({ action: 'cancel' }) },
      )
      applyPublishStatus(status)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      publishTickInFlightRef.current = false
    }
  }

  useEffect(() => {
    if (!siteId) return
    let mounted = true

    async function resumePublishIfRunning() {
      try {
        const status = await fetchJson<CatalogPublishStatus>(
          `/api/v1/integrations/woocommerce/sites/${siteId}/publish`,
        )
        if (!mounted || status.status !== 'running') return
        if (status.started_at) {
          publishStartedAtRef.current = new Date(status.started_at).getTime()
        }
        applyPublishStatus(status)
        startPublishPoll()
      } catch {
        // Ignore resume errors.
      }
    }

    void resumePublishIfRunning()
    return () => {
      mounted = false
      stopPublishPoll()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- resume only when site changes
  }, [siteId])

  if (!site) return <SyncDisabledNotice />

  async function runApply() {
    setError(null)
    await importRun.start()
  }

  const busy = loading || publishing || importRun.running

  return (
    <div className="flex flex-col gap-4">
      <SyncSection mode="automatico" title="Publicación y stock en tiempo real">
        <ul className="text-[12px] text-fg-muted list-disc pl-5 flex flex-col gap-1.5 leading-snug">
          <li>
            Cada movimiento de stock en el ERP (ventas, ajustes, recepciones) encola un push del disponible hacia WooCommerce,
            usando el depósito de la sucursal del sitio y el <strong>margen de seguridad</strong> de la pestaña Catálogo.
            No hace falta accionar nada acá: corre solo mientras el sitio esté activo.
          </li>
          <li>
            Nombre, precio y stock al publicar salen del ERP (lista de precios y auto-publicar se configuran en Catálogo).
          </li>
          <li>
            Último push de stock: <strong>{formatSyncedAt(site.last_stock_pushed_at)}</strong>
          </li>
        </ul>
      </SyncSection>

      <SyncSection mode="importacion" title="Backfill al conectar una tienda existente">
        <p className="text-[12px] text-fg-muted leading-snug">
          Usá esto una vez cuando WooCommerce ya tenía catálogo antes de Andiko. No reemplaza la sync automática de arriba.
        </p>
        <ul className="text-[12px] text-fg-muted list-disc pl-5 flex flex-col gap-1.5 leading-snug">
          <li><strong>Vincular por SKU:</strong> productos con el mismo SKU en Woo y en el ERP quedan enlazados sin duplicar.</li>
          <li><strong>Traer solo-Woo:</strong> productos con SKU único que existen en la tienda pero no en el ERP se pueden importar al catálogo.</li>
          <li><strong>Excluidos:</strong> sin SKU o con SKU duplicado en Woo — no se importan solos; hay que corregir el SKU en la tienda antes de reintentar.</li>
          <li><strong>Baseline de stock:</strong> al aplicar, elegís si alinear stock una sola vez (ERP→Woo, Woo→ERP o no tocar).</li>
        </ul>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" size="sm" variant="secondary" onClick={runPreview} disabled={busy}>
            {loading ? 'Procesando…' : 'Vista previa'}
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={runPublish} disabled={busy}>
            {publishing ? 'Publicando…' : 'Publicar catálogo ERP → Woo'}
          </Button>
        </div>
        <p className="text-[11px] text-fg-muted leading-snug">
          Envía todas las variantes del ERP a WooCommerce (nombre, precio, SKU). Los servicios se omiten.
          Con catálogos grandes el proceso corre en segundo plano; podés cerrar el modal y reabrir el sitio para ver el avance.
        </p>

        {publishing && (
          <StreamProgressPanel
            title={publishProgress && publishProgress.total > 0 ? 'Publicando catálogo…' : 'Encolando catálogo…'}
            unitLabel="variantes"
            processed={publishProgress?.processed ?? 0}
            total={publishProgress?.total ?? 0}
            eta={publishEta}
            hint={
              publishProgress && publishProgress.total > 0
                ? 'Enviando productos a WooCommerce.'
                : 'Preparando la cola en el servidor.'
            }
            onCancel={cancelPublish}
            cancelLabel="Cancelar publicación"
          />
        )}

        {publishResult && (
          <p className={`text-[12px] border rounded-sm px-3 py-2 ${publishCancelled ? 'text-warning bg-warning-bg border-warning' : 'text-success bg-success-bg border-success'}`}>
            {publishCancelled
              ? `Publicación cancelada. Enviadas ${publishResult.published.toLocaleString('es-AR')} variantes antes de detener.${publishResult.failed > 0 ? ` ${publishResult.failed.toLocaleString('es-AR')} con error.` : ''}`
              : publishResult.published === 0 && publishResult.skipped === 0
                ? 'No hay variantes en el ERP para publicar.'
                : `Publicadas ${publishResult.published.toLocaleString('es-AR')} variantes${publishResult.failed > 0 ? ` · ${publishResult.failed.toLocaleString('es-AR')} con error` : ''}. Revisá Productos en WooCommerce.`}
          </p>
        )}

        {preview && (
          <ImportPreviewBlock
            preview={preview}
            loading={loading}
            onSectionChange={(section) => loadPreview({ section, page: 1 })}
            onPageChange={(page) => loadPreview({ page })}
          />
        )}

        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <Switch
            checked={importUnmatched}
            onCheckedChange={setImportUnmatched}
            label="Importar productos que solo existen en WooCommerce"
          />
          <p className="text-[11px] text-fg-muted leading-snug -mt-2">
            Solo aplica a productos con SKU único en Woo. Los excluidos (sin SKU o duplicado) siguen fuera aunque este toggle esté activo.
          </p>
          <FormField label="Stock inicial (solo al aplicar esta importación)" htmlFor="woo_baseline_products">
            <Select
              id="woo_baseline_products"
              value={baseline}
              onChange={setBaseline}
              options={[
                { value: 'none', label: 'No tocar el stock' },
                { value: 'push_erp', label: 'Publicar stock del ERP a WooCommerce' },
                { value: 'seed_from_woo', label: 'Tomar el stock actual de WooCommerce como inicial en el ERP' },
              ]}
            />
            <p className="text-[11px] text-fg-muted leading-snug">
              Afecta una sola ejecución del backfill. Después, el stock continuo ERP → Woo sigue en automático.
            </p>
          </FormField>
        </div>

        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={runApply} disabled={busy}>
            {importRun.running ? 'Importando…' : 'Aplicar importación inicial'}
          </Button>
        </div>

        <WooImportRunPanel
          run={importRun}
          title="Importando productos…"
          hint="Vinculando e importando productos desde WooCommerce."
          cancelLabel="Cancelar importación"
          completeMessage={formatImportCompleteMessage(importRun, 'productos')}
          cancelledMessage={formatImportCancelledMessage(importRun, 'productos')}
        />

        {error && (
          <p role="alert" className="text-[12px] text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">
            {error}
          </p>
        )}
      </SyncSection>
    </div>
  )
}

interface WooOrdersSyncPanelProps {
  site: WooSiteRow | null
  onApplied: () => void
}

export function WooOrdersSyncPanel({ site, onApplied }: WooOrdersSyncPanelProps) {
  const siteId = site?.id ?? null
  const [importOrders, setImportOrders] = useState(true)
  const [openOrdersOnly, setOpenOrdersOnly] = useState(true)
  const { preview, loading, error, setError, runPreview, loadPreview } = useOrderImportPreview(site, openOrdersOnly)

  const importRun = useWooAsyncRun({
    siteId,
    endpoint: siteId ? importRunEndpoint(siteId) : '',
    unitLabel: 'pedidos',
    buildStartBody: () => ({
      scope: 'orders',
      import_unmatched_products: false,
      open_orders_only: openOrdersOnly,
      stock_baseline: 'none',
    }),
    onComplete: onApplied,
    onError: setError,
  })

  if (!site) return <SyncDisabledNotice />

  async function runApply() {
    if (!importOrders) return
    setError(null)
    await importRun.start()
  }

  const busy = loading || importRun.running

  return (
    <div className="flex flex-col gap-4">
      <SyncSection mode="automatico" title="Pedidos nuevos">
        <p className="text-[12px] text-fg-muted leading-snug">
          Cada pedido en WooCommerce llega solo por <strong>webhooks</strong> (y un cron de respaldo).
          Se crea un pedido de venta con origen WooCommerce y se descuenta stock de la sucursal del sitio.
          No hay botón de sync manual para el día a día.
        </p>
        <p className="text-[12px] text-fg-muted">
          Última sincronización de pedidos: <strong>{formatSyncedAt(site.last_order_synced_at)}</strong>
        </p>
      </SyncSection>

      <SyncSection mode="importacion" title="Backfill de pedidos históricos">
        <p className="text-[12px] text-fg-muted leading-snug">
          Solo para tiendas que ya tenían pedidos abiertos antes de conectar Andiko. No reemplaza la llegada automática de pedidos nuevos.
        </p>

        <Button type="button" size="sm" variant="secondary" onClick={runPreview} disabled={busy}>
          {loading ? 'Procesando…' : 'Vista previa'}
        </Button>

        {preview && (
          <OrderImportPreviewBlock
            preview={preview}
            loading={loading}
            onSectionChange={(section) => loadPreview({ section, page: 1 })}
            onPageChange={(page) => loadPreview({ page })}
          />
        )}

        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <Switch
            checked={importOrders}
            onCheckedChange={setImportOrders}
            label="Importar pedidos desde WooCommerce"
          />
          <Switch
            checked={openOrdersOnly}
            onCheckedChange={(checked) => {
              setOpenOrdersOnly(checked)
              if (preview) void loadPreview({ page: 1, refresh: true, openOrdersOnly: checked })
            }}
            label="Solo pedidos abiertos (no facturados ni cancelados)"
          />
          {preview && (
            <p className="text-[11px] text-fg-muted leading-snug -mt-2">
              Cambiá el filtro y volvé a ejecutar la vista previa si querés ver otro universo de pedidos.
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={runApply} disabled={busy || !importOrders}>
            {importRun.running ? 'Importando…' : 'Aplicar importación inicial de pedidos'}
          </Button>
        </div>

        <WooImportRunPanel
          run={importRun}
          title="Importando pedidos…"
          hint="Creando pedidos de venta desde WooCommerce."
          cancelLabel="Cancelar importación"
          completeMessage={formatImportCompleteMessage(importRun, 'pedidos')}
          cancelledMessage={formatImportCancelledMessage(importRun, 'pedidos')}
        />

        {error && (
          <p role="alert" className="text-[12px] text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">
            {error}
          </p>
        )}
      </SyncSection>
    </div>
  )
}

export function WooCustomersSyncPanel({ site, onApplied }: { site: WooSiteRow | null; onApplied?: () => void }) {
  const siteId = site?.id ?? null
  const { preview, loading, error, setError, runPreview, loadPreview } = useCustomerImportPreview(site)
  const [pushing, setPushing] = useState(false)
  const [pushResult, setPushResult] = useState<string | null>(null)

  const importRun = useWooAsyncRun({
    siteId,
    endpoint: siteId ? importRunEndpoint(siteId) : '',
    unitLabel: 'clientes',
    buildStartBody: () => ({
      scope: 'customers',
      import_unmatched_products: false,
      open_orders_only: true,
      stock_baseline: 'none',
    }),
    onComplete: () => {
      onApplied?.()
      if (preview) void loadPreview({ refresh: true })
    },
    onError: setError,
  })

  if (!site) return <SyncDisabledNotice />

  async function runApply() {
    setError(null)
    await importRun.start()
  }

  async function runPush() {
    setPushing(true)
    setError(null)
    setPushResult(null)
    try {
      const res = await fetchJson<CustomerPushResult>(
        `/api/v1/integrations/woocommerce/sites/${site!.id}/customers/push`,
        { method: 'POST', body: JSON.stringify({}) },
      )
      setPushResult(
        `Creados en Woo: ${res.created} · Actualizados: ${res.updated}${res.skipped > 0 ? ` · Omitidos: ${res.skipped}` : ''}`,
      )
      onApplied?.()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setPushing(false)
    }
  }

  const busy = loading || importRun.running || pushing

  return (
    <div className="flex flex-col gap-4">
      <SyncSection mode="automatico" title="Al ingresar un pedido">
        <p className="text-[12px] text-fg-muted leading-snug">
          Cada pedido nuevo (webhook o backfill) busca o crea el contacto automáticamente:
        </p>
        <ul className="text-[12px] text-fg-muted list-disc pl-5 flex flex-col gap-1.5 leading-snug">
          <li>Cuenta WooCommerce → vincula por ID de cliente.</li>
          <li>Mismo email que un contacto existente → reutiliza ese contacto.</li>
          <li>Invitado sin email → contacto predeterminado del sitio, si está configurado.</li>
        </ul>
      </SyncSection>

      <SyncSection mode="importacion" title="Importación desde WooCommerce">
        <p className="text-[12px] text-fg-muted leading-snug">
          Trae clientes registrados de la tienda al ERP y los vincula por email o crea contactos nuevos.
          Es idempotente: podés re-ejecutarla sin duplicar.
        </p>

        <Button type="button" size="sm" variant="secondary" onClick={runPreview} disabled={busy}>
          {loading ? 'Procesando…' : 'Vista previa'}
        </Button>

        {preview && (
          <CustomerImportPreviewBlock
            preview={preview}
            loading={loading}
            onSectionChange={(section) => loadPreview({ section, page: 1 })}
            onPageChange={(page) => loadPreview({ page })}
          />
        )}

        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={runApply} disabled={busy}>
            {importRun.running ? 'Importando…' : 'Aplicar importación de clientes'}
          </Button>
        </div>

        <WooImportRunPanel
          run={importRun}
          title="Importando clientes…"
          hint="Creando y vinculando contactos desde WooCommerce."
          cancelLabel="Cancelar importación"
          completeMessage={formatImportCompleteMessage(importRun, 'clientes')}
          cancelledMessage={formatImportCancelledMessage(importRun, 'clientes')}
        />

        {error && (
          <p role="alert" className="text-[12px] text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">
            {error}
          </p>
        )}
      </SyncSection>

      <SyncSection mode="importacion" title="Publicar contactos del ERP → WooCommerce">
        <p className="text-[12px] text-fg-muted leading-snug">
          Envía todos los contactos tipo cliente (o ambos) con email al sitio WooCommerce.
          Si ya están vinculados, actualiza nombre y email; si no, crea la cuenta en Woo y guarda el link.
        </p>

        <div className="flex justify-end">
          <Button type="button" size="sm" variant="secondary" onClick={runPush} disabled={busy}>
            {pushing ? 'Publicando…' : 'Publicar contactos a WooCommerce'}
          </Button>
        </div>

        {pushResult && (
          <p className="text-[12px] text-success bg-success-bg border border-success rounded-sm px-3 py-2">
            {pushResult}
          </p>
        )}
      </SyncSection>

      {error && (
        <p role="alert" className="text-[12px] text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">
          {error}
        </p>
      )}
    </div>
  )
}
