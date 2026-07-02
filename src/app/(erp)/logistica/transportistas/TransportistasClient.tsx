'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { FULFILLMENT_KIND_LABEL } from '@/modules/logistics/logistics.constants'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifyApiError, notifySuccess } from '@/lib/notify'
import { LogisticaSubNav } from '../LogisticaSubNav'
import { CarrierAccountDialog } from './CarrierAccountDialog'
import type { CarrierAccountRow } from '../types'

const PAGE_SIZE = 20

export function TransportistasClient() {
  const [rows, setRows]   = useState<CarrierAccountRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage]   = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [listError, setListError] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CarrierAccountRow | null>(null)
  const [deleting, setDeleting] = useState<CarrierAccountRow | null>(null)

  useEffect(() => {
    let mounted = true
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    ;(async () => {
      setListError(null)
      try {
        const data = await fetchJson<{ data: CarrierAccountRow[]; total: number }>(`/api/v1/logistics/carrier-accounts?${params}`)
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
      await fetchJson(`/api/v1/logistics/carrier-accounts/${target.id}`, { method: 'DELETE' })
      notifySuccess(`Transportista «${target.name}» eliminado`)
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    }
  }

  function openEdit(row: CarrierAccountRow) {
    setEditing(row)
    setDialogOpen(true)
  }

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  const columns: Column<CarrierAccountRow>[] = [
    {
      key: 'name',
      header: 'Nombre',
      render: row => <span className="font-medium text-fg">{row.name}</span>,
    },
    {
      key: 'kind',
      header: 'Tipo',
      render: row => <span className="text-[12px] text-fg-muted">{FULFILLMENT_KIND_LABEL[row.kind]}</span>,
    },
    {
      key: 'flat_rate',
      header: 'Costo fijo',
      align: 'right',
      render: row => {
        const rate = row.settings?.flat_rate
        return typeof rate === 'number' && rate > 0
          ? <span className="tabular-nums">{formatARS(rate)}</span>
          : <span className="text-fg-subtle">—</span>
      },
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
        breadcrumbs={[{ label: 'Logística', href: '/logistica/envios' }, { label: 'Transportistas' }]}
        actions={
          <Button size="sm" onClick={openCreate}>
            + Nuevo transportista
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
          emptyMessage="No hay transportistas. Creá al menos uno (p. ej. «Reparto propio») para generar envíos."
          footer={
            total > 0 ? (
              <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            ) : undefined
          }
        />
      </PageBody>

      <CarrierAccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={editing}
        onSaved={() => setRefresh(r => r + 1)}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => { if (!open) setDeleting(null) }}
        title="Eliminar transportista"
        description={`¿Eliminar «${deleting?.name ?? ''}»? Los envíos existentes conservan su historial.`}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDelete}
      />
    </div>
  )
}
