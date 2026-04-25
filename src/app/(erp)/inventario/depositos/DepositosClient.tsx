'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { Button } from '@/components/primitives/Button'
import { Badge } from '@/components/primitives/Badge'
import { InventarioSubNav } from '../InventarioSubNav'
import { DepositoModal } from './DepositoModal'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

type Warehouse = {
  id: string
  name: string
  description: string | null
  branch_id: string | null
  is_active: boolean
  created_at: string
}

const PAGE_SIZE = 20

const COLUMNS: Column<Warehouse>[] = [
  {
    key: 'name',
    header: 'Nombre',
    render: row => <span className="font-medium text-zinc-900">{row.name}</span>,
  },
  {
    key: 'description',
    header: 'Descripción',
    render: row => <span className="text-zinc-500 text-[13px]">{row.description ?? '—'}</span>,
  },
  {
    key: 'is_active',
    header: 'Estado',
    render: row => (
      <Badge status={row.is_active ? 'success' : 'neutral'}>
        {row.is_active ? 'Activo' : 'Inactivo'}
      </Badge>
    ),
  },
]

export function DepositosClient() {
  const router = useRouter()
  const [warehouses, setWarehouses] = useState<Warehouse[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Warehouse | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets loading state before async fetch
    setWarehouses(null)
    setError(null)
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    ;(async () => {
      try {
        const data = await fetchJson<{ data: Warehouse[]; total: number }>(`/api/v1/inventory/warehouses?${params}`)
        setWarehouses(data.data ?? [])
        setTotal(data.total ?? 0)
      } catch (e) {
        setError(getApiErrorMessage(e))
        setWarehouses([])
      }
    })()
  }, [page, refresh])

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function onSaved() {
    setModalOpen(false)
    setRefresh(r => r + 1)
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Inventario' }, { label: 'Depósitos' }]}
        actions={<Button size="sm" onClick={openCreate}>+ Nuevo depósito</Button>}
      />
      <InventarioSubNav />

      <div className="flex-1 overflow-auto p-5">
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        <DataTable
          columns={COLUMNS}
          data={warehouses}
          keyExtractor={row => row.id}
          onRowClick={row => router.push(`/inventario/depositos/${row.id}`)}
          emptyMessage="No hay depósitos. Creá uno para empezar."
          toolbar={
            <span className="text-[13px] text-zinc-500">
              {total > 0 ? `${total} depósito${total !== 1 ? 's' : ''}` : ''}
            </span>
          }
          footer={
            total > 0 ? (
              <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            ) : undefined
          }
        />
      </div>

      {modalOpen && (
        <DepositoModal
          warehouse={editing}
          onClose={() => setModalOpen(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}
