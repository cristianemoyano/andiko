'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { Badge } from '@/components/primitives/Badge'
import { InventarioSubNav } from '../InventarioSubNav'

type MovementRow = {
  id: string
  movement_type: string
  reference_type: string
  reference_id: string | null
  quantity_delta: string
  quantity_before: string
  quantity_after: string
  notes: string | null
  created_at: string
}

const MOVEMENT_TYPE_LABEL: Record<string, string> = {
  in:           'Entrada',
  out:          'Salida',
  adjustment:   'Ajuste',
  transfer_in:  'Transf. entrada',
  transfer_out: 'Transf. salida',
}

const PAGE_SIZE = 20

const COLUMNS: Column<MovementRow>[] = [
  {
    key: 'movement_type',
    header: 'Tipo',
    render: row => {
      const status = (row.movement_type === 'in' || row.movement_type === 'transfer_in')
        ? 'success'
        : (row.movement_type === 'out' || row.movement_type === 'transfer_out')
          ? 'error'
          : 'neutral'
      return <Badge status={status}>{MOVEMENT_TYPE_LABEL[row.movement_type] ?? row.movement_type}</Badge>
    },
  },
  {
    key: 'reference_type',
    header: 'Origen',
    render: row => <span className="text-zinc-500 text-[12px]">{row.reference_type}</span>,
  },
  {
    key: 'quantity_delta',
    header: 'Delta',
    render: row => (
      <span className={Number(row.quantity_delta) < 0 ? 'text-red-600 font-medium' : 'text-green-700 font-medium'}>
        {Number(row.quantity_delta) > 0 ? '+' : ''}{row.quantity_delta}
      </span>
    ),
  },
  {
    key: 'quantity_after',
    header: 'Saldo',
    render: row => <span className="tabular-nums">{row.quantity_after}</span>,
  },
  {
    key: 'notes',
    header: 'Notas',
    render: row => <span className="text-zinc-500 text-[12px]">{row.notes ?? '—'}</span>,
  },
  {
    key: 'created_at',
    header: 'Fecha',
    render: row => (
      <span className="text-zinc-500 text-[12px]">
        {new Date(row.created_at).toLocaleDateString('es-AR')}
      </span>
    ),
  },
]

export function MovimientosClient() {
  const [rows, setRows]   = useState<MovementRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage]   = useState(1)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets loading state before async fetch
    setRows(null)
    setError(null)
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    fetch(`/api/v1/inventory/movements?${params}`)
      .then(r => r.json())
      .then(data => { setRows(data.data ?? []); setTotal(data.total ?? 0) })
      .catch(() => { setError('Error al cargar movimientos'); setRows([]) })
  }, [page])

  return (
    <div className="flex flex-col h-full">
      <TopBar breadcrumbs={[{ label: 'Inventario' }, { label: 'Movimientos' }]} />
      <InventarioSubNav />
      <div className="flex-1 overflow-auto p-5">
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        <DataTable
          columns={COLUMNS}
          data={rows}
          keyExtractor={row => row.id}
          emptyMessage="Sin movimientos registrados."
        />
        <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>
    </div>
  )
}
