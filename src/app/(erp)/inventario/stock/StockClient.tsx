'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { Input } from '@/components/primitives/Input'
import { Button } from '@/components/primitives/Button'
import { Badge } from '@/components/primitives/Badge'
import { Dialog } from '@/components/primitives/Dialog'
import { InventarioSubNav } from '../InventarioSubNav'
import { STOCK_EXPIRY_WARNING_DAYS } from '@/modules/inventory/inventory.constants'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

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

function makeColumns(onShowBatches: (row: StockRow) => void): Column<StockRow>[] {
  return [
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
          <p className="font-medium text-zinc-900 text-[13px]">{productName}</p>
          <p className="text-zinc-400 text-[11px] font-mono">{variantLabel}</p>
        </div>
      )
    },
  },
  {
    key: 'warehouse_id',
    header: 'Depósito',
    render: row => <span className="text-zinc-700 text-[13px]">{row.warehouse?.name ?? row.warehouse_id}</span>,
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
      <span className="tabular-nums text-[13px] text-zinc-600">{row.minimum_quantity ?? '0'}</span>
    ),
  },
  {
    key: 'expires_on' as keyof StockRow,
    header: 'Vence',
    render: row => (
      <span className="text-[13px] text-zinc-600">
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
            <span className="text-zinc-400 text-[12px]">—</span>
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
  ]
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

  const [batchRow, setBatchRow]         = useState<StockRow | null>(null)
  const [batches, setBatches]           = useState<StockBatch[] | null>(null)
  const [batchError, setBatchError]     = useState<string | null>(null)

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

  const columns = makeColumns(setBatchRow)

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
  }, [page, debouncedSearch, belowMin, expired, expiring30])

  return (
    <div className="flex flex-col h-full">
      <TopBar breadcrumbs={[{ label: 'Inventario' }, { label: 'Stock' }]} />
      <InventarioSubNav />
      <div className="flex-1 overflow-auto p-5">
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        <DataTable
          columns={columns}
          data={rows}
          keyExtractor={row => row.id}
          emptyMessage="Sin stock registrado. Creá un depósito y registrá stock inicial."
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Buscar por producto o SKU…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                className="w-full sm:w-64"
              />
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
            </div>
          }
          footer={
            total > 0 ? (
              <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            ) : undefined
          }
        />
      </div>

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
          {batchError && <p className="text-red-600 text-sm mb-3">{batchError}</p>}
          {batches == null ? (
            <p className="text-zinc-400 text-[13px]">Cargando…</p>
          ) : batches.length === 0 ? (
            <p className="text-zinc-400 text-[13px]">Sin lotes registrados.</p>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
                  <th className="py-1.5 pr-3 font-semibold">Lote</th>
                  <th className="py-1.5 pr-3 font-semibold">Vence</th>
                  <th className="py-1.5 text-right font-semibold">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {batches.map(b => (
                  <tr key={b.id} className="border-t border-zinc-100">
                    <td className="py-1.5 pr-3 font-mono text-zinc-700">
                      {b.batch_code ?? <span className="text-zinc-400">Sin lote</span>}
                    </td>
                    <td className="py-1.5 pr-3 text-zinc-600">
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
    </div>
  )
}
