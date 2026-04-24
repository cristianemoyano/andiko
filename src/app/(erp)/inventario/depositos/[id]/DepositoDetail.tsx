'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { Button } from '@/components/primitives/Button'
import { Badge } from '@/components/primitives/Badge'
import { InventarioSubNav } from '../../InventarioSubNav'
import { AjusteStockModal } from './AjusteStockModal'

type StockRow = {
  id: string
  variant_id: string
  warehouse_id: string
  quantity: string
}

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

const STOCK_COLUMNS: Column<StockRow>[] = [
  { key: 'variant_id', header: 'Variante', render: row => <span className="font-mono text-[12px]">{row.variant_id}</span> },
  { key: 'quantity',   header: 'Cantidad',  render: row => <span className="font-medium">{row.quantity}</span> },
]

const MOVEMENT_COLUMNS: Column<MovementRow>[] = [
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
  { key: 'quantity_delta',  header: 'Delta',  render: row => <span className={Number(row.quantity_delta) < 0 ? 'text-red-600' : 'text-green-700'}>{row.quantity_delta}</span> },
  { key: 'quantity_after',  header: 'Saldo',  render: row => <span>{row.quantity_after}</span> },
  { key: 'reference_type',  header: 'Origen', render: row => <span className="text-zinc-500 text-[12px]">{row.reference_type}</span> },
  { key: 'created_at',      header: 'Fecha',  render: row => <span className="text-zinc-500 text-[12px]">{new Date(row.created_at).toLocaleDateString('es-AR')}</span> },
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
    const [stockRes, movRes, whRes] = await Promise.all([
      fetch(`/api/v1/inventory/stock?warehouse_id=${id}&page=${stockPage}&limit=${PAGE_SIZE}`),
      fetch(`/api/v1/inventory/movements?warehouse_id=${id}&page=${movPage}&limit=${PAGE_SIZE}`),
      fetch(`/api/v1/inventory/warehouses/${id}`),
    ])
    const [stockData, movData, whData] = await Promise.all([stockRes.json(), movRes.json(), whRes.json()])
    setStock(stockData.data ?? [])
    setStockTotal(stockData.total ?? 0)
    setMovements(movData.data ?? [])
    setMovTotal(movData.total ?? 0)
    setName(whData.name ?? '')
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
            Ajuste de stock
          </Button>
        }
      />
      <InventarioSubNav />

      <div className="flex-1 overflow-auto p-5 flex flex-col gap-6">
        <section>
          <h2 className="text-sm font-semibold text-zinc-700 mb-2">Stock actual</h2>
          <DataTable
            columns={STOCK_COLUMNS}
            data={stock}
            keyExtractor={row => row.id}
            emptyMessage="Sin stock registrado."
          />
          <TablePagination page={stockPage} pageSize={PAGE_SIZE} total={stockTotal} onPageChange={setStockPage} />
        </section>

        <section>
          <h2 className="text-sm font-semibold text-zinc-700 mb-2">Movimientos</h2>
          <DataTable
            columns={MOVEMENT_COLUMNS}
            data={movements}
            keyExtractor={row => row.id}
            emptyMessage="Sin movimientos registrados."
          />
          <TablePagination page={movPage} pageSize={PAGE_SIZE} total={movTotal} onPageChange={setMovPage} />
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
