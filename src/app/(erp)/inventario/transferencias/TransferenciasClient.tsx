'use client'

import { useState, useEffect, useCallback, useMemo, type Dispatch, type SetStateAction } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { DataTable, TablePagination, type Column, type TableRowSelection } from '@/components/erp'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { InventoryStockHint } from '@/components/erp/InventoryStockHint'
import { InventarioSubNav } from '../InventarioSubNav'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { useDebouncedValue } from '@/lib/use-debounced-value'

type Warehouse = { id: string; name: string }

type StockRow = {
  id: string
  variant_id: string
  quantity: string
  variant?: {
    id: string
    sku: string
    name: string | null
    is_default: boolean
    product?: { id: string; name: string }
  }
}

const PAGE_SIZE = 50

type TransferSelection = Record<string, { qty: string; maxQty: string }>

function selectionCount(items: TransferSelection): number {
  return Object.keys(items).length
}

function totalTransferQty(items: TransferSelection): number {
  return Object.values(items).reduce((sum, { qty }) => sum + (Number(qty) || 0), 0)
}

function handleFromChange(
  nextFrom: string,
  toId: string,
  setFromId: (v: string) => void,
  setToId: (v: string) => void,
  setErrors: Dispatch<SetStateAction<Record<string, string>>>,
  clearSelection: () => void,
  resetOrigin: () => void,
) {
  setFromId(nextFrom)
  clearSelection()
  resetOrigin()
  if (toId && toId === nextFrom) setToId('')
  setErrors(prev => {
    const next: Record<string, string> = { ...prev, from: '' }
    if (toId === nextFrom) next.to = ''
    return next
  })
}

function handleToChange(
  nextTo: string,
  fromId: string,
  setToId: (v: string) => void,
  setErrors: Dispatch<SetStateAction<Record<string, string>>>,
  clearSelection: () => void,
) {
  setToId(nextTo)
  clearSelection()
  if (fromId && nextTo === fromId) {
    setErrors(prev => ({ ...prev, to: 'Elegí un depósito distinto al origen' }))
  } else {
    setErrors(prev => ({ ...prev, to: '' }))
  }
}

function variantLabel(row: StockRow): { name: string; sku: string } {
  const v = row.variant
  if (!v) return { name: '—', sku: row.variant_id }
  return {
    name: v.product?.name ?? '—',
    sku:  v.is_default ? v.sku : `${v.name ?? v.sku} · ${v.sku}`,
  }
}

export function TransferenciasClient() {
  const searchParams = useSearchParams()
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [fromId, setFromId]         = useState(() => searchParams.get('from') ?? '')
  const [toId, setToId]             = useState('')
  const [notes, setNotes]           = useState('')
  const [errors, setErrors]         = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [lastResult, setLastResult] = useState<string | null>(null)
  const [refresh, setRefresh]       = useState(0)

  const [originRows, setOriginRows] = useState<StockRow[] | null>(null)
  const [originTotal, setOriginTotal] = useState(0)
  const [originPage, setOriginPage] = useState(1)
  const [destQtyByVariant, setDestQtyByVariant] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [transferItems, setTransferItems] = useState<TransferSelection>({})

  const destWarehouses = warehouses.filter(w => w.id !== fromId)
  const sameWarehouse = Boolean(fromId && toId && fromId === toId)
  const selectedCount = selectionCount(transferItems)
  const canSubmit = Boolean(fromId && toId && !sameWarehouse && selectedCount > 0)

  const fromName = warehouses.find(w => w.id === fromId)?.name ?? 'origen'
  const toName   = warehouses.find(w => w.id === toId)?.name ?? 'destino'

  const clearSelection = useCallback(() => setTransferItems({}), [])
  const resetOrigin = useCallback(() => {
    setOriginRows(null)
    setOriginTotal(0)
    setOriginPage(1)
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const data = await fetchJson<{ data: Warehouse[] }>('/api/v1/inventory/warehouses?limit=100')
        setWarehouses(data.data ?? [])
      } catch {
        setWarehouses([])
      }
    })()
  }, [])

  const debouncedSearch = useDebouncedValue(search, 300)

  useEffect(() => {
    if (!fromId) return
    const controller = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading state before fetch
    setOriginRows(null)
    const params = new URLSearchParams({
      warehouse_id: fromId,
      page: String(originPage),
      limit: String(PAGE_SIZE),
    })
    if (debouncedSearch) params.set('search', debouncedSearch)
    void (async () => {
      try {
        const data = await fetchJson<{ data: StockRow[]; total: number }>(
          `/api/v1/inventory/stock?${params}`,
          { signal: controller.signal },
        )
        setOriginRows(data.data ?? [])
        setOriginTotal(data.total ?? 0)
      } catch {
        if (controller.signal.aborted) return
        setOriginRows([])
        setOriginTotal(0)
      }
    })()
    return () => { controller.abort() }
  }, [fromId, originPage, debouncedSearch, refresh])

  useEffect(() => {
    if (!toId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when dest cleared
      setDestQtyByVariant({})
      return
    }
    const variantIds = [...new Set((originRows ?? []).map(r => r.variant_id))]
    if (originRows == null || variantIds.length === 0) return
    void (async () => {
      try {
        const entries = await Promise.all(
          variantIds.map(async variantId => {
            const params = new URLSearchParams({
              warehouse_id: toId,
              variant_id:   variantId,
              limit:        '1',
            })
            const data = await fetchJson<{ data: StockRow[] }>(`/api/v1/inventory/stock?${params}`)
            const qty = data.data?.[0]?.quantity ?? '0'
            return [variantId, qty] as const
          }),
        )
        setDestQtyByVariant(Object.fromEntries(entries))
      } catch {
        setDestQtyByVariant({})
      }
    })()
  }, [toId, originRows, refresh])

  const pageVariantIds = useMemo(
    () => (originRows ?? []).filter(r => Number(r.quantity) > 0).map(r => r.variant_id),
    [originRows],
  )

  const disabledVariantIds = useMemo(() => {
    const set = new Set<string>()
    for (const row of originRows ?? []) {
      if (Number(row.quantity) <= 0) set.add(row.variant_id)
    }
    return set
  }, [originRows])

  const toggleRow = useCallback((variantId: string) => {
    setTransferItems(prev => {
      if (variantId in prev) {
        const next = { ...prev }
        delete next[variantId]
        return next
      }
      const row = (originRows ?? []).find(r => r.variant_id === variantId)
      if (!row || Number(row.quantity) <= 0) return prev
      return { ...prev, [variantId]: { qty: row.quantity, maxQty: row.quantity } }
    })
  }, [originRows])

  function setRowQty(variantId: string, qty: string) {
    setTransferItems(prev => {
      const entry = prev[variantId]
      if (!entry) return prev
      return { ...prev, [variantId]: { ...entry, qty } }
    })
  }

  const togglePage = useCallback(() => {
    const selectable = (originRows ?? []).filter(r => Number(r.quantity) > 0)
    setTransferItems(prev => {
      const next = { ...prev }
      const allSelected = selectable.length > 0 && selectable.every(r => r.variant_id in next)
      if (allSelected) {
        for (const row of selectable) delete next[row.variant_id]
      } else {
        for (const row of selectable) {
          next[row.variant_id] = { qty: row.quantity, maxQty: row.quantity }
        }
      }
      return next
    })
  }, [originRows])

  const tableSelection = useMemo<TableRowSelection>(() => ({
    selectedIds: new Set(Object.keys(transferItems)),
    pageIds: pageVariantIds,
    disabledIds: disabledVariantIds,
    onToggleRow: toggleRow,
    onToggleAllOnPage: togglePage,
  }), [transferItems, pageVariantIds, disabledVariantIds, toggleRow, togglePage])

  const columns: Column<StockRow>[] = useMemo(() => [
    {
      key: 'id',
      header: 'Producto',
      render: row => {
        const { name, sku } = variantLabel(row)
        return (
          <div>
            <p className="font-medium text-fg text-[13px]">{name}</p>
            <p className="text-fg-subtle text-[11px] font-mono">{sku}</p>
          </div>
        )
      },
    },
    {
      key: 'quantity',
      header: `Stock ${fromName}`,
      render: row => <span className="tabular-nums text-[13px] font-medium">{row.quantity}</span>,
    },
    {
      key: 'transfer_qty' as keyof StockRow,
      header: 'Transferir',
      render: row => {
        const entry = transferItems[row.variant_id]
        if (!entry) return <span className="text-fg-subtle text-[12px]">—</span>
        return (
          <Input
            type="number"
            min={0}
            max={Number(entry.maxQty)}
            step="0.0001"
            value={entry.qty}
            onChange={e => setRowQty(row.variant_id, e.target.value)}
            className="h-8 w-24 tabular-nums text-[13px]"
            data-stop-row-click
            aria-label={`Cantidad a transferir de ${variantLabel(row).name}`}
          />
        )
      },
    },
    {
      key: 'dest' as keyof StockRow,
      header: `Stock ${toName}`,
      render: row => (
        <span className="tabular-nums text-[13px] text-fg-muted">
          {toId ? (destQtyByVariant[row.variant_id] ?? '0') : '—'}
        </span>
      ),
    },
  ], [transferItems, fromName, toName, toId, destQtyByVariant])

  function validateTransferItems(): string | null {
    for (const [variantId, { qty, maxQty }] of Object.entries(transferItems)) {
      const n = Number(qty)
      const max = Number(maxQty)
      if (!Number.isFinite(n) || n <= 0) {
        return 'Cada producto seleccionado debe tener una cantidad mayor a 0.'
      }
      if (n > max) {
        const row = (originRows ?? []).find(r => r.variant_id === variantId)
        const label = row ? variantLabel(row).name : variantId
        return `La cantidad de "${label}" supera el stock en origen (${maxQty}).`
      }
    }
    return null
  }

  async function submitTransfer() {
    setSubmitting(true)
    setServerError(null)
    setLastResult(null)
    try {
      const res = await fetchJson<{ moved_variants: number; skipped_variants: number }>('/api/v1/inventory/transfers', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'batch',
          from_warehouse_id: fromId,
          to_warehouse_id: toId,
          notes: notes.trim() || null,
          items: Object.entries(transferItems).map(([variant_id, { qty }]) => ({
            variant_id,
            quantity: Number(qty),
          })),
        }),
      })
      setLastResult(
        `Transferidos ${res.moved_variants} producto(s) a ${toName}${
          res.skipped_variants ? ` · ${res.skipped_variants} omitido(s)` : ''
        }.`,
      )
      clearSelection()
      setConfirmOpen(false)
      setRefresh(r => r + 1)
    } catch (e) {
      setServerError(getApiErrorMessage(e))
      setConfirmOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  function openConfirm() {
    const errs: Record<string, string> = {}
    if (!fromId) errs.from = 'Elegí depósito origen'
    if (!toId) errs.to = 'Elegí depósito destino'
    if (sameWarehouse) errs.to = 'Elegí un depósito distinto al origen'
    if (selectedCount === 0) {
      setServerError('Seleccioná al menos un producto.')
      return
    }
    const qtyErr = validateTransferItems()
    if (qtyErr) {
      setServerError(qtyErr)
      return
    }
    if (Object.keys(errs).length) { setErrors(errs); return }
    setServerError(null)
    setConfirmOpen(true)
  }

  const confirmTotal = totalTransferQty(transferItems)

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Inventario' }, { label: 'Transferencias' }]}
        actions={
          <Button size="sm" disabled={submitting || !canSubmit} onClick={openConfirm}>
            {submitting ? 'Transfiriendo…' : `Transferir seleccionados (${selectedCount})`}
          </Button>
        }
      />
      <InventarioSubNav />
      <PageBody className="flex flex-col gap-5">
        <InventoryStockHint screen="transferencias" />

        <div className="bg-surface border border-border rounded-sm p-5 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField label="Depósito origen" error={errors.from} required>
              <select
                className="h-9 w-full rounded-md border border-border bg-surface px-2 text-[13px]"
                value={fromId}
                onChange={e => handleFromChange(e.target.value, toId, setFromId, setToId, setErrors, clearSelection, resetOrigin)}
              >
                <option value="">Seleccionar…</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Depósito destino" error={errors.to} required>
              <select
                className="h-9 w-full rounded-md border border-border bg-surface px-2 text-[13px] disabled:opacity-50"
                value={toId}
                disabled={!fromId || destWarehouses.length === 0}
                onChange={e => handleToChange(e.target.value, fromId, setToId, setErrors, clearSelection)}
              >
                <option value="">
                  {!fromId
                    ? 'Elegí origen primero'
                    : destWarehouses.length === 0
                      ? 'No hay otro depósito'
                      : 'Seleccionar…'}
                </option>
                {destWarehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Notas (opcional)">
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Motivo de la transferencia" />
            </FormField>
          </div>

          {fromId && (
            <Button type="button" variant="ghost" size="sm" className="self-start" asChild>
              <Link href={`/inventario/depositos/${fromId}`}>Ver detalle del depósito origen</Link>
            </Button>
          )}

          {(serverError || lastResult) && (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              {serverError && (
                <p role="alert" className="text-[13px] text-danger bg-danger-bg border border-danger rounded-sm px-4 py-2.5">
                  {serverError}
                </p>
              )}
              {lastResult && (
                <p role="status" className="text-[13px] text-success bg-success-bg border border-success rounded-sm px-4 py-2.5">
                  {lastResult}
                </p>
              )}
            </div>
          )}
        </div>

        {!fromId ? (
          <p className="text-[13px] text-fg-muted py-8 text-center">Elegí un depósito origen para ver los productos disponibles.</p>
        ) : (
          <DataTable
            columns={columns}
            data={originRows}
            keyExtractor={row => row.variant_id}
            selection={tableSelection}
            emptyMessage="Sin stock en el depósito origen."
            toolbar={
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  placeholder="Buscar por producto o SKU…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setOriginPage(1) }}
                  className="w-full sm:w-72"
                />
                {selectedCount > 0 && (
                  <span className="text-[12px] text-fg-subtle">
                    {selectedCount} seleccionado(s) · {confirmTotal} unidad(es)
                  </span>
                )}
              </div>
            }
            footer={
              originTotal > 0 ? (
                <TablePagination
                  page={originPage}
                  pageSize={PAGE_SIZE}
                  total={originTotal}
                  onPageChange={setOriginPage}
                />
              ) : undefined
            }
          />
        )}
      </PageBody>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirmar transferencia"
        description={`¿Transferir ${selectedCount} producto(s) (${confirmTotal} unidad(es) en total) de "${fromName}" a "${toName}"?`}
        confirmLabel="Transferir"
        variant="warning"
        onConfirm={submitTransfer}
      />
    </div>
  )
}
