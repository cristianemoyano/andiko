'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, TablePagination, type Column, type TableRowSelection } from '@/components/erp'
import { Input } from '@/components/primitives/Input'
import { Button } from '@/components/primitives/Button'
import { Badge } from '@/components/primitives/Badge'
import { Dialog } from '@/components/primitives/Dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/primitives/DropdownMenu'
import { InventarioSubNav } from '../InventarioSubNav'
import { InventoryStockHint } from '@/components/erp/InventoryStockHint'
import { STOCK_EXPIRY_WARNING_DAYS } from '@/modules/inventory/inventory.constants'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { BulkStockMinimumModal } from './BulkStockMinimumModal'
import { BulkStockExpiryModal } from './BulkStockExpiryModal'
import { useSearchParams } from 'next/navigation'

type StockRow = {
  id: string
  variant_id: string
  warehouse_id: string
  org_id: string
  quantity: string
  minimum_quantity?: string
  expires_on?: string | null
  warehouse?: { id: string; name: string; branch_id: string | null }
  variant?: {
    id: string
    sku: string
    name: string | null
    is_default: boolean
    product?: { id: string; name: string }
  }
}

type Warehouse = { id: string; name: string }

const PAGE_SIZE = 20

function utcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

function parseExpiresOn(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const s = String(iso).slice(0, 10)
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(Date.UTC(y, m - 1, d))
}

function expiryFlags(expiresOn: string | null | undefined): { expired: boolean; soon: boolean } {
  const exp = parseExpiresOn(expiresOn ?? null)
  if (!exp) return { expired: false, soon: false }
  const today = new Date()
  const t0 = utcDay(today)
  const tExp = utcDay(exp)
  if (tExp < t0) return { expired: true, soon: false }
  const limit = t0 + STOCK_EXPIRY_WARNING_DAYS * 86400000
  if (tExp <= limit) return { expired: false, soon: true }
  return { expired: false, soon: false }
}

function belowMinimum(row: StockRow): boolean {
  const min = Number(row.minimum_quantity ?? 0)
  if (min <= 0) return false
  return Number(row.quantity) <= min
}

type StockBatch = {
  id: string
  batch_code: string | null
  expiry_date: string | null
  quantity: string
}

function stockSelectionKey(row: StockRow): string {
  return `${row.variant_id}:${row.warehouse_id}`
}

function makeColumns(
  onShowBatches: (row: StockRow) => void,
  showWarehouseColumn: boolean,
): Column<StockRow>[] {
  const cols: Column<StockRow>[] = [
  {
    key: 'variant_id',
    header: 'Producto',
    render: row => {
      const productName = row.variant?.product?.name ?? '—'
      const variantLabel = row.variant
        ? row.variant.is_default
          ? row.variant.sku
          : `${row.variant.name ?? row.variant.sku} (${row.variant.sku})`
        : row.variant_id
      return (
        <div>
          <p className="font-medium text-fg text-[13px]">{productName}</p>
          <p className="text-fg-subtle text-[11px] font-mono">{variantLabel}</p>
        </div>
      )
    },
  },
  ]
  if (showWarehouseColumn) {
    cols.splice(1, 0, {
      key: 'warehouse_id',
      header: 'Depósito',
      render: row => <span className="text-fg-muted text-[13px]">{row.warehouse?.name ?? row.warehouse_id}</span>,
    })
  }
  cols.push(
  {
    key: 'quantity',
    header: 'Cantidad',
    render: row => <span className="font-medium tabular-nums text-[13px]">{row.quantity}</span>,
  },
  {
    key: 'minimum_quantity' as keyof StockRow,
    header: 'Mín.',
    render: row => (
      <span className="tabular-nums text-[13px] text-fg-muted">{row.minimum_quantity ?? '0'}</span>
    ),
  },
  {
    key: 'expires_on' as keyof StockRow,
    header: 'Vence',
    render: row => (
      <span className="text-[13px] text-fg-muted">
        {row.expires_on ? String(row.expires_on).slice(0, 10).split('-').reverse().join('/') : '—'}
      </span>
    ),
  },
  {
    key: 'id',
    header: 'Alertas',
    render: row => {
      const { expired, soon } = expiryFlags(row.expires_on)
      const low = belowMinimum(row)
      return (
        <div className="flex flex-wrap gap-1">
          {low && (
            <Badge status="pending" dot>Bajo mínimo</Badge>
          )}
          {expired && (
            <Badge status="error" dot>Vencido</Badge>
          )}
          {!expired && soon && (
            <Badge status="pending" dot>Vence pronto</Badge>
          )}
          {!low && !expired && !soon && (
            <span className="text-fg-subtle text-[12px]">—</span>
          )}
        </div>
      )
    },
  },
  {
    key: 'batches' as keyof StockRow,
    header: 'Lotes',
    align: 'right',
    render: row => (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        data-stop-row-click
        onClick={() => onShowBatches(row)}
      >
        Ver lotes
      </Button>
    ),
  },
  )
  return cols
}

export function StockClient() {
  const searchParams = useSearchParams()

  const [rows, setRows]                 = useState<StockRow[] | null>(null)
  const [total, setTotal]               = useState(0)
  const [page, setPage]                 = useState(1)
  const [error, setError]               = useState<string | null>(null)
  const [search, setSearch]             = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [belowMin, setBelowMin]         = useState(() => searchParams.get('below_minimum') === 'true')
  const [expired, setExpired]           = useState(() => searchParams.get('expired') === 'true')
  const [expiring30, setExpiring30]     = useState(() => searchParams.get('expiring_within_days') != null)
  const [warehouseId, setWarehouseId]   = useState(() => searchParams.get('warehouse_id') ?? '')
  const [warehouses, setWarehouses]     = useState<Warehouse[]>([])
  const [selected, setSelected]         = useState<Set<string>>(() => new Set())
  const [bulkModal, setBulkModal]       = useState<'minimum' | 'expiry' | null>(null)
  const [refresh, setRefresh]           = useState(0)

  const [batchRow, setBatchRow]         = useState<StockRow | null>(null)
  const [batches, setBatches]           = useState<StockBatch[] | null>(null)
  const [batchError, setBatchError]     = useState<string | null>(null)

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

  useEffect(() => {
    if (!batchRow) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets loading state before async fetch
    setBatches(null)
    setBatchError(null)
    ;(async () => {
      try {
        const data = await fetchJson<{ data: StockBatch[] }>(`/api/v1/inventory/stock/${batchRow.id}/batches`)
        setBatches(data.data ?? [])
      } catch (e) {
        setBatchError(getApiErrorMessage(e))
        setBatches([])
      }
    })()
  }, [batchRow])

  const toggleRow = useCallback((key: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const pageKeys = useMemo(
    () => (rows ?? []).map(stockSelectionKey),
    [rows],
  )

  const togglePage = useCallback(() => {
    setSelected(prev => {
      const next = new Set(prev)
      const allSelected = pageKeys.length > 0 && pageKeys.every(k => next.has(k))
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

  const bulkItems = useMemo(
    () => Array.from(selected).map(key => {
      const [variant_id, warehouse_id] = key.split(':')
      return { variant_id, warehouse_id }
    }),
    [selected],
  )

  const columns = useMemo(
    () => makeColumns(setBatchRow, !warehouseId),
    [warehouseId],
  )

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(id)
  }, [search])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets loading state before async fetch
    setRows(null)
    setError(null)
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (belowMin)       params.set('below_minimum', 'true')
    if (expired)        params.set('expired', 'true')
    if (expiring30)    params.set('expiring_within_days', '30')
    if (warehouseId)   params.set('warehouse_id', warehouseId)
    ;(async () => {
      try {
        const data = await fetchJson<{ data: StockRow[]; total: number }>(`/api/v1/inventory/stock?${params}`)
        setRows(data.data ?? [])
        setTotal(data.total ?? 0)
      } catch (e) {
        setError(getApiErrorMessage(e))
        setRows([])
      }
    })()
  }, [page, debouncedSearch, belowMin, expired, expiring30, warehouseId, refresh])

  function handleWarehouseChange(nextId: string) {
    setWarehouseId(nextId)
    setSelected(new Set())
    setPage(1)
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Inventario' }, { label: 'Stock' }]}
        actions={
          selected.size > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" aria-label="Acciones en lote">
                  Acciones ({selected.size})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setBulkModal('minimum')}>
                  Configurar mínimo
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setBulkModal('expiry')}>
                  Configurar vencimiento
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : undefined
        }
      />
      <InventarioSubNav />
      <PageBody className="flex flex-col gap-5">
        <InventoryStockHint screen="stock" />
        {error && <p className="text-danger text-sm mb-4">{error}</p>}
        <DataTable
          columns={columns}
          data={rows}
          keyExtractor={stockSelectionKey}
          selection={tableSelection}
          emptyMessage="Sin stock registrado. Creá un depósito y registrá stock inicial."
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Buscar por producto o SKU…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                className="w-full sm:w-64"
              />
              <select
                className="h-8 rounded-md border border-border bg-surface px-2 text-[13px] text-fg-muted focus:outline-none focus:ring-2 focus:ring-border-strong"
                value={warehouseId}
                onChange={e => handleWarehouseChange(e.target.value)}
              >
                <option value="">Todos los depósitos</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
              <Button
                type="button"
                variant={belowMin ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => { setBelowMin(v => !v); setPage(1) }}
              >
                Bajo mínimo
              </Button>
              <Button
                type="button"
                variant={expired ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => { setExpired(v => !v); setPage(1) }}
              >
                Vencidos
              </Button>
              <Button
                type="button"
                variant={expiring30 ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => { setExpiring30(v => !v); setPage(1) }}
              >
                Vencen en 30 días
              </Button>
              {selected.size > 0 && (
                <span className="text-[12px] text-fg-subtle">{selected.size} seleccionado(s)</span>
              )}
            </div>
          }
          footer={
            total > 0 ? (
              <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            ) : undefined
          }
        />
      </PageBody>

      <Dialog
        open={batchRow != null}
        onOpenChange={open => { if (!open) setBatchRow(null) }}
        title="Lotes"
        description={
          batchRow
            ? `${batchRow.variant?.product?.name ?? ''} · ${batchRow.warehouse?.name ?? ''}`.trim()
            : undefined
        }
        size="md"
      >
        <div className="px-5 py-4">
          {batchError && <p className="text-danger text-sm mb-3">{batchError}</p>}
          {batches == null ? (
            <p className="text-fg-subtle text-[13px]">Cargando…</p>
          ) : batches.length === 0 ? (
            <p className="text-fg-subtle text-[13px]">Sin lotes registrados.</p>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-fg-muted">
                  <th className="py-1.5 pr-3 font-semibold">Lote</th>
                  <th className="py-1.5 pr-3 font-semibold">Vence</th>
                  <th className="py-1.5 text-right font-semibold">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {batches.map(b => (
                  <tr key={b.id} className="border-t border-border">
                    <td className="py-1.5 pr-3 font-mono text-fg-muted">
                      {b.batch_code ?? <span className="text-fg-subtle">Sin lote</span>}
                    </td>
                    <td className="py-1.5 pr-3 text-fg-muted">
                      {b.expiry_date ? String(b.expiry_date).slice(0, 10).split('-').reverse().join('/') : '—'}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{b.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Dialog>

      {bulkModal === 'minimum' && (
        <BulkStockMinimumModal
          items={bulkItems}
          onClose={() => setBulkModal(null)}
          onSaved={() => {
            setBulkModal(null)
            setSelected(new Set())
            setRefresh(r => r + 1)
          }}
        />
      )}

      {bulkModal === 'expiry' && (
        <BulkStockExpiryModal
          items={bulkItems}
          onClose={() => setBulkModal(null)}
          onSaved={() => {
            setBulkModal(null)
            setSelected(new Set())
            setRefresh(r => r + 1)
          }}
        />
      )}
    </div>
  )
}
