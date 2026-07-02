'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifyApiError, notifySuccess } from '@/lib/notify'
import { LogisticaSubNav } from '../LogisticaSubNav'
import { VehicleDialog } from './VehicleDialog'
import type { VehicleRow } from '../types'

const PAGE_SIZE = 20

export function VehiculosClient() {
  const [rows, setRows] = useState<VehicleRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [listError, setListError] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<VehicleRow | null>(null)
  const [deleting, setDeleting] = useState<VehicleRow | null>(null)

  useEffect(() => {
    let mounted = true
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    ;(async () => {
      setListError(null)
      try {
        const data = await fetchJson<{ data: VehicleRow[]; total: number }>(`/api/v1/logistics/vehicles?${params}`)
        if (!mounted) return
        setRows(Array.isArray(data?.data) ? data.data : [])
        setTotal(typeof data?.total === 'number' ? data.total : 0)
      } catch (e) {
        if (!mounted) return
        setListError(getApiErrorMessage(e))
        setRows([])
        setTotal(0)
      }
    })()
    return () => { mounted = false }
  }, [page, refresh])

  async function handleDelete() {
    if (!deleting) return
    const target = deleting
    setDeleting(null)
    try {
      await fetchJson(`/api/v1/logistics/vehicles/${target.id}`, { method: 'DELETE' })
      notifySuccess(`Vehículo «${target.label}» eliminado`)
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    }
  }

  function openEdit(row: VehicleRow) {
    setEditing(row)
    setDialogOpen(true)
  }

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  const columns: Column<VehicleRow>[] = [
    {
      key: 'label',
      header: 'Vehículo',
      render: row => <span className="font-medium text-fg">{row.label}</span>,
    },
    {
      key: 'plate',
      header: 'Patente',
      render: row => row.plate
        ? <span className="font-mono text-[12px] text-fg-muted">{row.plate}</span>
        : <span className="text-fg-subtle">—</span>,
    },
    {
      key: 'is_active',
      header: 'Estado',
      render: row => (
        <Badge status={row.is_active ? 'success' : 'draft'} dot>
          {row.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      className: 'w-[140px]',
      mobileRole: 'actions',
      render: row => (
        <div
          className="flex items-center justify-end gap-1"
          data-stop-row-click
          onClick={e => e.stopPropagation()}
        >
          <Button variant="secondary" size="xs" onClick={() => openEdit(row)}>
            Editar
          </Button>
          <Button variant="ghost" size="xs" onClick={() => setDeleting(row)}>
            Eliminar
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Logística', href: '/logistica/envios' }, { label: 'Vehículos' }]}
        actions={
          <Button size="sm" onClick={openCreate}>
            + Nuevo vehículo
          </Button>
        }
      />
      <LogisticaSubNav />

      <PageBody>
        {listError && (
          <div className="mb-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
            {listError}
          </div>
        )}
        <DataTable
          columns={columns}
          data={rows}
          keyExtractor={r => r.id}
          emptyMessage="No hay vehículos cargados. Agregá la flota para asignarla en reparto propio."
          footer={
            total > 0 ? (
              <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            ) : undefined
          }
        />
      </PageBody>

      <VehicleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        vehicle={editing}
        onSaved={() => setRefresh(r => r + 1)}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => { if (!open) setDeleting(null) }}
        title="Eliminar vehículo"
        description={`¿Eliminar «${deleting?.label ?? ''}»? Los envíos existentes conservan el dato histórico.`}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDelete}
      />
    </div>
  )
}
