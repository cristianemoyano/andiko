'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { Input } from '@/components/primitives/Input'
import { Button } from '@/components/primitives/Button'
import { Badge } from '@/components/primitives/Badge'
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

const COLUMNS: Column<StockRow>[] = [
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
]

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
          columns={COLUMNS}
          data={rows}
          keyExtractor={row => row.id}
          emptyMessage="Sin stock registrado. Creá un depósito y registrá stock inicial."
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Buscar por producto o SKU…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                className="w-64"
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
    </div>
  )
}
