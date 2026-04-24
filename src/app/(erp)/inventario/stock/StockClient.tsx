'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { InventarioSubNav } from '../InventarioSubNav'

type StockRow = {
  id: string
  variant_id: string
  warehouse_id: string
  org_id: string
  quantity: string
  warehouse?: { id: string; name: string; branch_id: string | null }
}

const PAGE_SIZE = 20

const COLUMNS: Column<StockRow>[] = [
  {
    key: 'warehouse_id',
    header: 'Depósito',
    render: row => <span className="text-zinc-700">{row.warehouse?.name ?? row.warehouse_id}</span>,
  },
  {
    key: 'variant_id',
    header: 'Variante',
    render: row => <span className="font-mono text-[12px] text-zinc-500">{row.variant_id}</span>,
  },
  {
    key: 'quantity',
    header: 'Cantidad',
    render: row => <span className="font-medium tabular-nums">{row.quantity}</span>,
  },
]

export function StockClient() {
  const [rows, setRows]   = useState<StockRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage]   = useState(1)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets loading state before async fetch
    setRows(null)
    setError(null)
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    fetch(`/api/v1/inventory/stock?${params}`)
      .then(r => r.json())
      .then(data => { setRows(data.data ?? []); setTotal(data.total ?? 0) })
      .catch(() => { setError('Error al cargar stock'); setRows([]) })
  }, [page])

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
        />
        <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>
    </div>
  )
}
