'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { Badge } from '@/components/primitives/Badge'
import { Input } from '@/components/primitives/Input'
import { InventoryStockHint } from '@/components/erp/InventoryStockHint'
import { InventarioSubNav } from '../InventarioSubNav'
import type { StockMovementType, StockReferenceType } from '@/modules/inventory/stock-movement.model'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { useDebouncedValue } from '@/lib/use-debounced-value'

type Warehouse = { id: string; name: string }

type MovementRow = {
  id: string
  movement_type: StockMovementType
  reference_type: StockReferenceType
  reference_id: string | null
  order_number: string | null
  quantity_delta: string
  quantity_before: string
  quantity_after: string
  notes: string | null
  created_at: string
  warehouse?: { id: string; name: string }
  variant?: {
    id: string
    sku: string
    name: string | null
    is_default: boolean
    product?: { id: string; name: string }
  }
  batch?: {
    id: string
    batch_code: string | null
    expiry_date: string | null
  } | null
}

const MOVEMENT_TYPE_LABEL: Record<StockMovementType, string> = {
  in:           'Entrada',
  out:          'Salida',
  adjustment:   'Ajuste',
  transfer_in:  'Transf. entrada',
  transfer_out: 'Transf. salida',
}

const REFERENCE_TYPE_LABEL: Record<string, string> = {
  order:            'Pedido',
  invoice_cancel:   'Anulación factura',
  manual:           'Manual',
  initial:          'Stock inicial',
  transfer:         'Transferencia',
  purchase_receipt: 'Recepción compra',
  delivery_note:    'Remito de entrega',
  sales_return:     'Devolución venta',
  sales_exchange:   'Cambio venta',
  purchase_return:  'Devolución compra',
  purchase_exchange: 'Cambio compra',
  production_order: 'Orden de producción',
}

const PAGE_SIZE = 20

function movementBadgeStatus(type: StockMovementType): 'success' | 'error' | 'neutral' {
  if (type === 'in' || type === 'transfer_in')   return 'success'
  if (type === 'out' || type === 'transfer_out') return 'error'
  return 'neutral'
}

function referenceLabel(row: MovementRow): string {
  if (row.reference_type === 'order')            return row.order_number ?? REFERENCE_TYPE_LABEL.order
  if (row.reference_type === 'purchase_receipt') return row.notes ?? REFERENCE_TYPE_LABEL.purchase_receipt
  return REFERENCE_TYPE_LABEL[row.reference_type] ?? row.reference_type
}

function productLabel(row: MovementRow): { name: string; sku: string } {
  const name = row.variant?.product?.name ?? '—'
  const sku  = row.variant
    ? row.variant.is_default
      ? row.variant.sku
      : `${row.variant.name ?? row.variant.sku} · ${row.variant.sku}`
    : '—'
  return { name, sku }
}

const COLUMNS: Column<MovementRow>[] = [
  {
    key: 'movement_type',
    header: 'Tipo',
    render: row => (
      <Badge status={movementBadgeStatus(row.movement_type)}>
        {MOVEMENT_TYPE_LABEL[row.movement_type] ?? row.movement_type}
      </Badge>
    ),
  },
  {
    key: 'warehouse' as keyof MovementRow,
    header: 'Depósito',
    render: row => (
      <span className="text-fg-muted text-[12px]">{row.warehouse?.name ?? '—'}</span>
    ),
  },
  {
    key: 'variant_id' as keyof MovementRow,
    header: 'Producto',
    render: row => {
      const { name, sku } = productLabel(row)
      return (
        <div>
          <p className="font-medium text-fg text-[13px]">{name}</p>
          <p className="text-fg-subtle text-[11px] font-mono">{sku}</p>
        </div>
      )
    },
  },
  {
    key: 'reference_type',
    header: 'Origen',
    render: row => (
      <span className="text-fg-muted text-[12px]">{referenceLabel(row)}</span>
    ),
  },
  {
    key: 'batch' as keyof MovementRow,
    header: 'Lote',
    render: row => {
      if (!row.batch || (!row.batch.batch_code && !row.batch.expiry_date)) {
        return <span className="text-fg-subtle text-[12px]">—</span>
      }
      return (
        <div className="text-[12px]">
          {row.batch.batch_code && (
            <span className="font-mono text-fg-muted">{row.batch.batch_code}</span>
          )}
          {row.batch.expiry_date && (
            <span className="block text-fg-subtle text-[11px]">
              Vto. {String(row.batch.expiry_date).slice(0, 10).split('-').reverse().join('/')}
            </span>
          )}
        </div>
      )
    },
  },
  {
    key: 'quantity_delta',
    header: 'Delta',
    render: row => (
      <span className={`font-medium tabular-nums text-[13px] ${Number(row.quantity_delta) < 0 ? 'text-danger' : 'text-success'}`}>
        {Number(row.quantity_delta) > 0 ? '+' : ''}{row.quantity_delta}
      </span>
    ),
  },
  {
    key: 'quantity_after',
    header: 'Saldo',
    render: row => <span className="tabular-nums text-[13px]">{row.quantity_after}</span>,
  },
  {
    key: 'created_at',
    header: 'Fecha',
    render: row => (
      <span className="text-fg-muted text-[12px]">
        {new Date(row.created_at).toLocaleDateString('es-AR')}
      </span>
    ),
  },
]

const REFERENCE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Todos los orígenes' },
  { value: 'order', label: 'Pedido' },
  { value: 'manual', label: 'Manual' },
  { value: 'initial', label: 'Stock inicial' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'purchase_receipt', label: 'Recepción compra' },
  { value: 'invoice_cancel', label: 'Anulación factura' },
]

export function MovimientosClient() {
  const [rows, setRows]               = useState<MovementRow[] | null>(null)
  const [total, setTotal]             = useState(0)
  const [page, setPage]               = useState(1)
  const [error, setError]             = useState<string | null>(null)
  const [search, setSearch]           = useState('')
  const [refType, setRefType]         = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [warehouses, setWarehouses]   = useState<Warehouse[]>([])

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
    const controller = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets loading state before async fetch
    setRows(null)
    setError(null)
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (refType)         params.set('reference_type', refType)
    if (warehouseId)     params.set('warehouse_id', warehouseId)
    ;(async () => {
      try {
        const data = await fetchJson<{ data: MovementRow[]; total: number }>(
          `/api/v1/inventory/movements?${params}`,
          { signal: controller.signal },
        )
        setRows(data.data ?? [])
        setTotal(data.total ?? 0)
      } catch (e) {
        if (controller.signal.aborted) return
        setError(getApiErrorMessage(e))
        setRows([])
      }
    })()
    return () => { controller.abort() }
  }, [page, debouncedSearch, refType, warehouseId])

  return (
    <div className="flex flex-col h-full">
      <TopBar breadcrumbs={[{ label: 'Inventario' }, { label: 'Movimientos' }]} />
      <InventarioSubNav />
      <PageBody className="flex flex-col gap-5">
        <InventoryStockHint screen="movimientos" />
        {error && <p className="text-danger text-sm mb-4">{error}</p>}
        <DataTable
          columns={COLUMNS}
          data={rows}
          keyExtractor={row => row.id}
          emptyMessage="Sin movimientos registrados."
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
                onChange={e => { setWarehouseId(e.target.value); setPage(1) }}
              >
                <option value="">Todos los depósitos</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
              <select
                className="h-8 rounded-md border border-border bg-surface px-2 text-[13px] text-fg-muted focus:outline-none focus:ring-2 focus:ring-border-strong"
                value={refType}
                onChange={e => { setRefType(e.target.value); setPage(1) }}
              >
                {REFERENCE_FILTER_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          }
          footer={
            total > 0 ? (
              <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            ) : undefined
          }
        />
      </PageBody>
    </div>
  )
}
