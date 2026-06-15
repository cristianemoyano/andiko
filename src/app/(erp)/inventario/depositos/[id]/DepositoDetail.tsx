'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { Button } from '@/components/primitives/Button'
import { Badge } from '@/components/primitives/Badge'
import { InventarioSubNav } from '../../InventarioSubNav'
import { AjusteStockModal } from './AjusteStockModal'
import type { StockMovementType, StockReferenceType } from '@/modules/inventory/stock-movement.model'
import { STOCK_EXPIRY_WARNING_DAYS } from '@/modules/inventory/inventory.constants'
import { fetchJson } from '@/lib/fetch-json'
import { notifyApiError } from '@/lib/notify'

type VariantInfo = {
  id: string
  sku: string
  name: string | null
  is_default: boolean
  product?: { id: string; name: string }
}

type StockRow = {
  id: string
  variant_id: string
  warehouse_id: string
  quantity: string
  minimum_quantity?: string
  expires_on?: string | null
  variant?: VariantInfo
}

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
  variant?: VariantInfo
}

const MOVEMENT_TYPE_LABEL: Record<StockMovementType, string> = {
  in:           'Entrada',
  out:          'Salida',
  adjustment:   'Ajuste',
  transfer_in:  'Transf. entrada',
  transfer_out: 'Transf. salida',
}

const REFERENCE_TYPE_LABEL: Record<StockReferenceType, string> = {
  order:            'Pedido',
  invoice_cancel:   'Anulación factura',
  manual:           'Manual',
  initial:          'Stock inicial',
  purchase_receipt: 'Recepción compra',
  delivery_note:    'Remito de entrega',
}

function movementBadgeStatus(type: StockMovementType): 'success' | 'error' | 'neutral' {
  if (type === 'in' || type === 'transfer_in')   return 'success'
  if (type === 'out' || type === 'transfer_out') return 'error'
  return 'neutral'
}

function variantLabel(v: VariantInfo | undefined, fallback: string): { name: string; sku: string } {
  if (!v) return { name: '—', sku: fallback }
  return {
    name: v.product?.name ?? '—',
    sku:  v.is_default ? v.sku : `${v.name ?? v.sku} · ${v.sku}`,
  }
}

function referenceLabel(row: MovementRow): string {
  if (row.reference_type === 'order') return row.order_number ?? REFERENCE_TYPE_LABEL.order
  return REFERENCE_TYPE_LABEL[row.reference_type] ?? row.reference_type
}

const STOCK_COLUMNS: Column<StockRow>[] = [
  {
    key: 'variant_id',
    header: 'Producto',
    render: row => {
      const { name, sku } = variantLabel(row.variant, row.variant_id)
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
          {low && <Badge status="pending" dot>Bajo mínimo</Badge>}
          {expired && <Badge status="error" dot>Vencido</Badge>}
          {!expired && soon && <Badge status="pending" dot>Vence pronto</Badge>}
          {!low && !expired && !soon && <span className="text-fg-subtle text-[12px]">—</span>}
        </div>
      )
    },
  },
]

const MOVEMENT_COLUMNS: Column<MovementRow>[] = [
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
    key: 'variant_id' as keyof MovementRow,
    header: 'Producto',
    render: row => {
      const { name, sku } = variantLabel(row.variant, '—')
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

const PAGE_SIZE = 20

export function DepositoDetail() {
  const { id } = useParams<{ id: string }>()

  const [stock, setStock]             = useState<StockRow[] | null>(null)
  const [stockTotal, setStockTotal]   = useState(0)
  const [stockPage, setStockPage]     = useState(1)

  const [movements, setMovements]     = useState<MovementRow[] | null>(null)
  const [movTotal, setMovTotal]       = useState(0)
  const [movPage, setMovPage]         = useState(1)

  const [warehouseName, setName]      = useState('')
  const [ajusteOpen, setAjusteOpen]   = useState(false)
  const [refresh, setRefresh]         = useState(0)

  const fetchData = useCallback(async () => {
    setStock(null)
    setMovements(null)
    try {
      const [stockData, movData, whData] = await Promise.all([
        fetchJson<{ data: StockRow[]; total: number }>(
          `/api/v1/inventory/stock?warehouse_id=${id}&page=${stockPage}&limit=${PAGE_SIZE}`,
        ),
        fetchJson<{ data: MovementRow[]; total: number }>(
          `/api/v1/inventory/movements?warehouse_id=${id}&page=${movPage}&limit=${PAGE_SIZE}`,
        ),
        fetchJson<{ name: string }>(`/api/v1/inventory/warehouses/${id}`),
      ])
      setStock(stockData.data ?? [])
      setStockTotal(stockData.total ?? 0)
      setMovements(movData.data ?? [])
      setMovTotal(movData.total ?? 0)
      setName(whData.name ?? '')
    } catch (e) {
      notifyApiError(e)
      setStock([])
      setStockTotal(0)
      setMovements([])
      setMovTotal(0)
    }
  }, [id, stockPage, movPage])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchData resets loading state before async fetch
    fetchData()
  }, [fetchData, refresh])

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Inventario' },
          { label: 'Depósitos', href: '/inventario/depositos' },
          { label: warehouseName || '…' },
        ]}
        actions={
          <Button size="sm" onClick={() => setAjusteOpen(true)}>
            Stock y alertas
          </Button>
        }
      />
      <InventarioSubNav />

      <div className="flex-1 overflow-auto p-5 flex flex-col gap-6">
        <section>
          <h2 className="text-sm font-semibold text-fg-muted mb-2">Stock actual</h2>
          <DataTable
            columns={STOCK_COLUMNS}
            data={stock}
            keyExtractor={row => row.id}
            emptyMessage="Sin stock registrado."
            footer={
              stockTotal > 0 ? (
                <TablePagination page={stockPage} pageSize={PAGE_SIZE} total={stockTotal} onPageChange={setStockPage} />
              ) : undefined
            }
          />
        </section>

        <section>
          <h2 className="text-sm font-semibold text-fg-muted mb-2">Movimientos</h2>
          <DataTable
            columns={MOVEMENT_COLUMNS}
            data={movements}
            keyExtractor={row => row.id}
            emptyMessage="Sin movimientos registrados."
            footer={
              movTotal > 0 ? (
                <TablePagination page={movPage} pageSize={PAGE_SIZE} total={movTotal} onPageChange={setMovPage} />
              ) : undefined
            }
          />
        </section>
      </div>

      {ajusteOpen && (
        <AjusteStockModal
          warehouseId={id}
          onClose={() => setAjusteOpen(false)}
          onSaved={() => { setAjusteOpen(false); setRefresh(r => r + 1) }}
        />
      )}
    </div>
  )
}
