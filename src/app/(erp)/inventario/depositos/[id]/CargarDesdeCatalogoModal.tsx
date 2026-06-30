'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Dialog, DialogFooter } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Checkbox } from '@/components/primitives/Checkbox'
import { DataTable, TablePagination, type Column, type TableRowSelection } from '@/components/erp'
import { fetchJson, getApiErrorMessage, isApiRequestError } from '@/lib/fetch-json'
import { fieldErrorsFromApiError } from '@/lib/validation-errors'
import { formatImportEtaRemaining, isImportAbortError, readImportStream } from '@/lib/import-progress'
import { notifyInfo, notifySuccess } from '@/lib/notify'

type CandidateRow = {
  variant_id: string
  sku: string
  variant_name: string | null
  product_name: string
  warehouse_quantity: string
  in_warehouse: boolean
}

interface CargarDesdeCatalogoModalProps {
  warehouseId: string
  onClose: () => void
  onSaved: (result: { updated: number; skipped: number }) => void
}

const PAGE_SIZE = 50
const LOAD_BATCH_SIZE = 100

function formatLoadCatalogError(e: unknown): string {
  const fieldErrors = fieldErrorsFromApiError(e)
  const itemsErr = fieldErrors?.items?.[0]
  if (itemsErr) return itemsErr
  if (isApiRequestError(e) && e.message !== 'Invalid input' && e.message !== 'Datos inválidos') {
    return getApiErrorMessage(e)
  }
  return 'No se pudo cargar el stock. Revisá las cantidades e intentá de nuevo.'
}

function variantLabel(row: CandidateRow): string {
  if (row.variant_name) return `${row.product_name} · ${row.variant_name}`
  return row.product_name
}

export function CargarDesdeCatalogoModal({ warehouseId, onClose, onSaved }: CargarDesdeCatalogoModalProps) {
  const [rows, setRows] = useState<CandidateRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [onlyNotInWarehouse, setOnlyNotInWarehouse] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [bulkQty, setBulkQty] = useState('')
  const [massQty, setMassQty] = useState('')
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{ processed: number; total: number } | null>(null)
  const [bulkEta, setBulkEta] = useState<string | null>(null)
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null)
  const bulkAbortRef = useRef<AbortController | null>(null)

  useEffect(() => () => { bulkAbortRef.current?.abort() }, [])

  const filterQuery = useCallback(() => {
    const params = new URLSearchParams()
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim())
    if (onlyNotInWarehouse) params.set('only_not_in_warehouse', 'true')
    return params
  }, [debouncedSearch, onlyNotInWarehouse])

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(search)
      setSelected(new Set())
      setPage(1)
    }, 300)
    return () => clearTimeout(id)
  }, [search])

  useEffect(() => {
    let cancelled = false
    const params = filterQuery()
    params.set('page', String(page))
    params.set('limit', String(PAGE_SIZE))

    void (async () => {
      try {
        const data = await fetchJson<{ data: CandidateRow[]; total: number }>(
          `/api/v1/inventory/warehouses/${warehouseId}/catalog-candidates?${params}`,
        )
        if (cancelled) return
        setRows(data.data ?? [])
        setTotal(data.total ?? 0)
      } catch {
        if (cancelled) return
        setRows([])
        setTotal(0)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [warehouseId, page, filterQuery])

  const toggleRow = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const pageKeys = useMemo(() => (rows ?? []).map((row) => row.variant_id), [rows])

  const togglePage = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev)
      const allSelected = pageKeys.length > 0 && pageKeys.every((k) => next.has(k))
      if (allSelected) {
        for (const k of pageKeys) next.delete(k)
      } else {
        for (const k of pageKeys) next.add(k)
      }
      return next
    })
  }, [pageKeys])

  const tableSelection = useMemo<TableRowSelection>(() => ({
    selectedIds: selected,
    pageIds: pageKeys,
    onToggleRow: toggleRow,
    onToggleAllOnPage: togglePage,
  }), [selected, pageKeys, toggleRow, togglePage])

  function applyBulkQuantity() {
    const n = Number(bulkQty.replace(',', '.'))
    if (!Number.isFinite(n) || n < 0) return
    const value = String(n)
    setQuantities((prev) => {
      const next = { ...prev }
      for (const id of selected) next[id] = value
      return next
    })
  }

  const bulkProgressPct = bulkProgress && bulkProgress.total > 0
    ? Math.min(100, Math.round((bulkProgress.processed / bulkProgress.total) * 100))
    : 0

  function handleBulkCancel() {
    bulkAbortRef.current?.abort()
  }

  function handleBulkCancelled(partial?: { updated: number; skipped: number }) {
    const updated = partial?.updated ?? 0
    if (updated > 0) {
      notifyInfo(
        `Carga detenida. ${updated.toLocaleString('es-AR')} producto(s) ya cargado(s); el resto no se modificó.`,
      )
      onSaved({ updated, skipped: partial?.skipped ?? 0 })
    } else {
      notifyInfo('Carga detenida. No se aplicaron cambios nuevos.')
    }
    setBulkProgress(null)
    setBulkEta(null)
  }

  async function handleBulkLoadAll() {
    setServerError(null)
    setBulkFeedback(null)

    const massQtyTrimmed = massQty.trim()
    if (!massQtyTrimmed) {
      setBulkFeedback('Ingresá una cantidad antes de cargar.')
      return
    }

    const quantity = Number(massQtyTrimmed.replace(',', '.'))
    if (!Number.isFinite(quantity) || quantity < 0) {
      setBulkFeedback('Ingresá una cantidad válida para la carga masiva.')
      return
    }
    if (quantity === 0) {
      setBulkFeedback('La cantidad debe ser mayor a cero.')
      return
    }
    if (total === 0) {
      setBulkFeedback('No hay productos que coincidan con el filtro actual.')
      return
    }

    setBulkSubmitting(true)
    setBulkProgress({ processed: 0, total })
    setBulkEta(null)
    const startedAt = Date.now()

    bulkAbortRef.current?.abort()
    const abortController = new AbortController()
    bulkAbortRef.current = abortController

    try {
      const res = await fetch(
        `/api/v1/inventory/warehouses/${warehouseId}/stock/load-from-catalog-bulk`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          signal: abortController.signal,
          body: JSON.stringify({
            quantity,
            search: debouncedSearch.trim() || undefined,
            only_not_in_warehouse: onlyNotInWarehouse,
            stream: true,
          }),
        },
      )

      const contentType = res.headers.get('content-type') ?? ''

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? 'Error al cargar stock')
      }

      let updated = 0
      let skipped = 0

      if (contentType.includes('application/x-ndjson')) {
        const result = await readImportStream(
          res,
          (processed, progressTotal) => {
            setBulkProgress({ processed, total: progressTotal })
            setBulkEta(formatImportEtaRemaining(processed, progressTotal, Date.now() - startedAt))
          },
          { signal: abortController.signal },
        )
        updated = result.updated
        skipped = result.skipped
        setBulkProgress({ processed: total, total })
      } else {
        const data = await res.json() as { updated?: number; skipped?: number; unchanged?: number }
        updated = data.updated ?? 0
        skipped = (data.skipped ?? 0) + (data.unchanged ?? 0)
        setBulkProgress({ processed: total, total })
      }

      if (updated === 0) {
        setBulkFeedback(
          skipped > 0
            ? 'Ningún producto recibió cantidad: los que coinciden ya tienen stock cargado en este depósito.'
            : 'No se actualizó ningún producto. Revisá el filtro y la cantidad ingresada.',
        )
        return
      }

      const message = skipped > 0
        ? `${updated.toLocaleString('es-AR')} producto(s) cargado(s). ${skipped.toLocaleString('es-AR')} omitido(s) porque ya tenían stock.`
        : `${updated.toLocaleString('es-AR')} producto(s) cargado(s) correctamente.`
      notifySuccess(message)
      onSaved({ updated, skipped })
    } catch (e) {
      if (isImportAbortError(e)) {
        handleBulkCancelled()
        return
      }
      if (e instanceof Error && e.message === 'IMPORT_STREAM_CANCELLED') {
        const partial = (e as Error & { cancelled?: { updated: number; skipped: number } }).cancelled
        handleBulkCancelled(partial)
        return
      }
      if (e instanceof Error && e.message.startsWith('IMPORT_STREAM')) {
        setBulkFeedback('No se pudo leer el progreso de la carga. Intentá de nuevo.')
      } else {
        setBulkFeedback(e instanceof Error ? e.message : 'Error al cargar stock')
      }
    } finally {
      bulkAbortRef.current = null
      setBulkSubmitting(false)
    }
  }

  const columns = useMemo<Column<CandidateRow>[]>(() => [
    {
      key: 'product_name',
      header: 'Producto',
      render: (row) => (
        <div>
          <p className="font-medium text-fg text-[13px]">{variantLabel(row)}</p>
          <p className="text-fg-subtle text-[11px] font-mono">{row.sku}</p>
        </div>
      ),
    },
    {
      key: 'warehouse_quantity',
      header: 'En este depósito',
      render: (row) => (
        <span className="tabular-nums text-[13px] text-fg-muted">
          {row.in_warehouse ? row.warehouse_quantity : '—'}
        </span>
      ),
    },
    {
      key: 'quantity_input',
      header: 'Cantidad a cargar',
      render: (row) => (
        <Input
          type="number"
          min={0}
          step="0.0001"
          value={quantities[row.variant_id] ?? ''}
          onChange={(e) => {
            const value = e.target.value
            setQuantities((prev) => ({ ...prev, [row.variant_id]: value }))
            if (value.trim()) {
              setSelected((prev) => {
                if (prev.has(row.variant_id)) return prev
                const next = new Set(prev)
                next.add(row.variant_id)
                return next
              })
            }
          }}
          placeholder="0"
          className="h-7 text-[12px] max-w-[7rem]"
          onClick={(e) => e.stopPropagation()}
          disabled={bulkSubmitting || submitting}
        />
      ),
    },
  ], [quantities, bulkSubmitting, submitting])

  async function handleSubmit() {
    setServerError(null)

    const missingQty = Array.from(selected).filter((variantId) => {
      const raw = (quantities[variantId] ?? '').trim()
      if (!raw) return true
      const quantity = Number(raw.replace(',', '.'))
      return !Number.isFinite(quantity) || quantity < 0
    })
    if (missingQty.length > 0) {
      setServerError(
        missingQty.length === 1
          ? 'Falta ingresar una cantidad válida en 1 producto seleccionado.'
          : `Falta ingresar una cantidad válida en ${missingQty.length} productos seleccionados.`,
      )
      return
    }

    const byVariant = new Map<string, number>()
    for (const variantId of selected) {
      const raw = (quantities[variantId] ?? '').trim()
      const quantity = Number(raw.replace(',', '.'))
      byVariant.set(variantId, quantity)
    }
    const items = Array.from(byVariant.entries()).map(([variant_id, quantity]) => ({
      variant_id,
      quantity,
    }))

    if (items.length === 0) {
      setServerError('Seleccioná al menos un producto.')
      return
    }

    setSubmitting(true)
    try {
      let totalUpdated = 0
      let totalUnchanged = 0
      for (let start = 0; start < items.length; start += LOAD_BATCH_SIZE) {
        const batch = items.slice(start, start + LOAD_BATCH_SIZE)
        const result = await fetchJson<{ updated: number; unchanged: number }>(
          `/api/v1/inventory/warehouses/${warehouseId}/stock/load-from-catalog`,
          {
            method: 'POST',
            body: JSON.stringify({ items: batch }),
          },
        )
        totalUpdated += result.updated
        totalUnchanged += result.unchanged
      }
      if (totalUpdated === 0 && totalUnchanged > 0) {
        setServerError('Las cantidades elegidas ya coinciden con el stock actual.')
        return
      }
      notifySuccess(`${totalUpdated} producto(s) cargado(s) correctamente.`)
      onSaved({ updated: totalUpdated, skipped: totalUnchanged })
    } catch (e) {
      setServerError(formatLoadCatalogError(e))
    } finally {
      setSubmitting(false)
    }
  }

  const busy = bulkSubmitting || submitting

  return (
    <Dialog
      open
      onOpenChange={(open) => { if (!open && !busy) onClose() }}
      title="Cargar desde catálogo"
      description="Carga masiva por filtro o selección puntual de productos del catálogo."
      size="lg"
      padded={false}
      footer={(
        <DialogFooter error={serverError}>
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={handleSubmit} disabled={busy || selected.size === 0}>
            {submitting ? 'Cargando…' : `Cargar selección${selected.size > 0 ? ` (${selected.size})` : ''}`}
          </Button>
        </DialogFooter>
      )}
    >
      <div className="flex flex-col gap-4 px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar por nombre, SKU o código de barras…"
            className="flex-1 h-8 text-[13px]"
            disabled={busy}
          />
          <label className="flex items-center gap-2 text-[12px] text-fg-muted shrink-0 cursor-pointer">
            <Checkbox
              checked={onlyNotInWarehouse}
              onCheckedChange={(v) => {
                setOnlyNotInWarehouse(v === true)
                setSelected(new Set())
                setPage(1)
              }}
              disabled={busy}
            />
            Solo no cargados acá
          </label>
        </div>

        <div className="rounded-md border border-brand-accent-border bg-gradient-to-br from-brand-50 to-brand-50/40 p-4 shadow-sm">
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-[13px] font-semibold text-fg">Carga masiva</p>
              <p className="text-[12px] text-fg-muted mt-0.5 leading-relaxed">
                Aplica la misma cantidad a los productos del filtro que{' '}
                <span className="font-medium text-fg">aún no tienen stock en este depósito</span>
                {' '}(<span className="tabular-nums">{total.toLocaleString('es-AR')}</span>
                {' '}coinciden con el filtro). No reemplaza cantidades ya cargadas. El servidor procesa todo con progreso en tiempo real.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end gap-2">
              <div className="flex flex-col gap-1 flex-1 min-w-[8rem]">
                <label className="text-[11px] font-medium text-fg-muted" htmlFor="mass-qty">
                  Cantidad para todos
                </label>
                <Input
                  id="mass-qty"
                  type="number"
                  min={0}
                  step="0.0001"
                  value={massQty}
                  onChange={(e) => setMassQty(e.target.value)}
                  placeholder="ej. 10"
                  className="h-9 text-[13px] bg-surface"
                  disabled={busy || total === 0}
                />
              </div>
              <Button
                type="button"
                size="sm"
                className="h-9 px-4 shadow-sm font-semibold sm:min-w-[11rem]"
                onClick={handleBulkLoadAll}
                disabled={busy || total === 0 || !massQty.trim()}
              >
                {bulkSubmitting
                  ? 'Cargando…'
                  : `Cargar todos (${total.toLocaleString('es-AR')})`}
              </Button>
            </div>

            {bulkSubmitting && bulkProgress && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-medium text-fg">Procesando en el servidor…</span>
                  <span className="text-fg-muted tabular-nums">
                    {bulkProgress.processed.toLocaleString('es-AR')} / {bulkProgress.total.toLocaleString('es-AR')} ({bulkProgressPct}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface/80 border border-brand-accent-border/60">
                  <div
                    className="h-full rounded-full bg-brand-600 transition-[width] duration-300 ease-out"
                    style={{ width: `${Math.max(bulkProgressPct, 3)}%` }}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-fg-muted">
                    Podés detener en cualquier momento.{bulkEta ? ` ${bulkEta}.` : ''}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7 text-[12px]"
                    onClick={handleBulkCancel}
                  >
                    Detener carga
                  </Button>
                </div>
              </div>
            )}

            {bulkFeedback && (
              <p className="text-[12px] text-danger leading-relaxed" role="alert">
                {bulkFeedback}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-[12px] text-fg-muted">
          <span className="h-px flex-1 bg-border" />
          <span className="shrink-0 px-1">o elegí productos puntuales</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-end gap-2 rounded border border-border bg-surface-muted/60 px-3 py-2">
            <div className="flex flex-col gap-1 min-w-[8rem]">
              <span className="text-[11px] font-medium text-fg-muted">
                Cantidad para {selected.size} seleccionado(s)
              </span>
              <Input
                type="number"
                min={0}
                step="0.0001"
                value={bulkQty}
                onChange={(e) => setBulkQty(e.target.value)}
                placeholder="0"
                className="h-7 text-[12px]"
                disabled={busy}
              />
            </div>
            <Button type="button" size="sm" variant="secondary" onClick={applyBulkQuantity} disabled={busy}>
              Aplicar
            </Button>
          </div>
        )}

        <DataTable
          columns={columns}
          data={rows}
          keyExtractor={(row) => row.variant_id}
          selection={tableSelection}
          emptyMessage={
            onlyNotInWarehouse
              ? 'Todos los productos del catálogo ya tienen registro en este depósito.'
              : 'No hay productos del catálogo que gestionen stock.'
          }
          footer={
            total > PAGE_SIZE ? (
              <TablePagination
                page={page}
                pageSize={PAGE_SIZE}
                total={total}
                onPageChange={setPage}
              />
            ) : null
          }
        />

      </div>
    </Dialog>
  )
}
