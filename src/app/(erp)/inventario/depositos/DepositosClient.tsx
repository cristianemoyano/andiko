'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { Button } from '@/components/primitives/Button'
import { Badge } from '@/components/primitives/Badge'
import { DropdownMenuItem } from '@/components/primitives/DropdownMenu'
import { InventarioSubNav } from '../InventarioSubNav'
import { DepositoModal } from './DepositoModal'
import { InventoryStockHint } from '@/components/erp/InventoryStockHint'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import type { BranchListItem } from '@/components/erp/BranchSelectField'

type Warehouse = {
  id: string
  name: string
  description: string | null
  branch_id: string | null
  branchLabel?: string
  is_active: boolean
  created_at: string
}

const PAGE_SIZE = 20

const COLUMNS: Column<Warehouse>[] = [
  {
    key: 'name',
    header: 'Nombre',
    render: row => <span className="font-medium text-fg">{row.name}</span>,
  },
  {
    key: 'branch_id',
    header: 'Sucursal',
    render: row => (
      <span className="text-fg-muted text-[13px]">
        {row.branchLabel ?? (row.branch_id ? '…' : 'Central')}
      </span>
    ),
  },
  {
    key: 'description',
    header: 'Descripción',
    render: row => <span className="text-fg-muted text-[13px]">{row.description ?? '—'}</span>,
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
        const [warehouseRes, branchRes] = await Promise.all([
          fetchJson<{ data: Warehouse[]; total: number }>(`/api/v1/inventory/warehouses?${params}`),
          fetchJson<{ data: BranchListItem[] }>('/api/v1/branches'),
        ])
        const branchLabels = new Map(
          (branchRes.data ?? []).map(b => [b.id, `${String(b.branch_code).padStart(2, '0')} — ${b.name}`]),
        )
        setWarehouses((warehouseRes.data ?? []).map(w => ({
          ...w,
          branchLabel: w.branch_id ? branchLabels.get(w.branch_id) : undefined,
        })))
        setTotal(warehouseRes.total ?? 0)
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

  function openEdit(row: Warehouse) {
    setEditing(row)
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

      <PageBody className="flex flex-col gap-5">
        <InventoryStockHint screen="depositos" />
        {error && <p className="text-danger text-sm mb-4">{error}</p>}
        <DataTable
          columns={[
            ...COLUMNS,
            {
              key: '_actions',
              header: '',
              className: 'w-[88px]',
              mobileRole: 'actions' as const,
              align: 'right',
              render: row => (
                <div data-stop-row-click onClick={e => e.stopPropagation()}>
                  <Button variant="secondary" size="xs" onClick={() => openEdit(row)}>
                    Editar
                  </Button>
                </div>
              ),
              mobileRender: row => (
                <DropdownMenuItem onSelect={() => openEdit(row)}>Editar</DropdownMenuItem>
              ),
            },
          ]}
          data={warehouses}
          keyExtractor={row => row.id}
          onRowClick={row => router.push(`/inventario/depositos/${row.id}`)}
          emptyMessage="No hay depósitos. Creá uno para empezar."
          toolbar={
            <span className="text-[13px] text-fg-muted">
              {total > 0 ? `${total} depósito${total !== 1 ? 's' : ''}` : ''}
            </span>
          }
          footer={
            total > 0 ? (
              <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            ) : undefined
          }
        />
      </PageBody>

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
