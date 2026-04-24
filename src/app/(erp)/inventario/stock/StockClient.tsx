'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { Input } from '@/components/primitives/Input'
import { InventarioSubNav } from '../InventarioSubNav'

type StockRow = {
  id: string
  variant_id: string
  warehouse_id: string
  org_id: string
  quantity: string
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
]

export function StockClient() {
  const [rows, setRows]       = useState<StockRow[] | null>(null)
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [error, setError]     = useState<string | null>(null)
  const [search, setSearch]   = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

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
    fetch(`/api/v1/inventory/stock?${params}`)
      .then(r => r.json())
      .then(data => { setRows(data.data ?? []); setTotal(data.total ?? 0) })
      .catch(() => { setError('Error al cargar stock'); setRows([]) })
  }, [page, debouncedSearch])

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
            <Input
              placeholder="Buscar por producto o SKU…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="w-64"
            />
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
