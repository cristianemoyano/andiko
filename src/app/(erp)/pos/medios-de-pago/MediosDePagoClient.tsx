'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { DataTable, type Column, ConfirmDialog } from '@/components/erp'
import { StatusBadge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { fetchJson } from '@/lib/fetch-json'
import { notifyApiError, notifySuccess } from '@/lib/notify'
import { MedioPagoModal } from './MedioPagoModal'

export type PosPaymentMethodRow = {
  id: string
  name: string
  type: string
  requires_reference: boolean
  is_active: boolean
  sort_order: number
  branchAssignments: Array<{ branch_id: string; is_active: boolean }>
}

const TYPE_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  qr: 'QR',
  current_account: 'Cuenta corriente',
  check: 'Cheque',
  other: 'Otro',
}

export function MediosDePagoClient() {
  const [methods, setMethods] = useState<PosPaymentMethodRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PosPaymentMethodRow | null>(null)
  const [deleting, setDeleting] = useState<PosPaymentMethodRow | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchJson<{ data: PosPaymentMethodRow[] }>('/api/v1/pos/org-payment-methods')
      .then(res => { if (!cancelled) { setMethods(res.data); setLoading(false) } })
      .catch(err => { if (!cancelled) { notifyApiError(err); setLoading(false) } })
    return () => { cancelled = true }
  }, [refresh])

  async function handleDelete() {
    if (!deleting) return
    try {
      await fetchJson(`/api/v1/pos/org-payment-methods/${deleting.id}`, { method: 'DELETE' })
      notifySuccess('Medio de pago eliminado')
      setRefresh(r => r + 1)
    } catch (err) {
      notifyApiError(err)
    } finally {
      setDeleting(null)
    }
  }

  const actionCol: Column<PosPaymentMethodRow> = {
    key: 'id',
    header: '',
    render: row => (
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => setEditing(row)}>Editar</Button>
        <Button
          size="sm" variant="ghost"
          onClick={() => setDeleting(row)}
          className="text-danger hover:text-danger hover:bg-danger-bg"
        >
          Eliminar
        </Button>
      </div>
    ),
  }

  const columns: Column<PosPaymentMethodRow>[] = [
    {
      key: 'name',
      header: 'Nombre',
      render: row => (
        <div>
          <span className="text-sm font-medium text-fg">{row.name}</span>
          {row.requires_reference && (
            <p className="text-xs text-fg-subtle mt-0.5">Requiere referencia</p>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Tipo',
      render: row => (
        <span className="text-sm text-fg-muted">{TYPE_LABELS[row.type] ?? row.type}</span>
      ),
    },
    {
      key: 'branchAssignments',
      header: 'Sucursales',
      render: row => {
        const count = row.branchAssignments?.length ?? 0
        return (
          <span className="text-sm text-fg-muted">
            {count === 0 ? <span className="text-fg-subtle">Ninguna</span> : `${count} sucursal${count !== 1 ? 'es' : ''}`}
          </span>
        )
      },
    },
    {
      key: 'sort_order',
      header: 'Orden',
      render: row => <span className="text-sm text-fg-muted">{row.sort_order}</span>,
    },
    {
      key: 'is_active',
      header: 'Estado',
      render: row => <StatusBadge value={row.is_active ? 'Activo' : 'Inactivo'} />,
    },
    actionCol,
  ]

  return (
    <>
      <TopBar
        breadcrumbs={[{ label: 'POS' }, { label: 'Medios de pago' }]}
        actions={
          <Button size="sm" onClick={() => setModalOpen(true)}>+ Nuevo medio de pago</Button>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-fg-subtle text-sm">Cargando…</div>
        ) : methods.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <p className="text-fg-muted text-sm">No hay medios de pago configurados.</p>
            <p className="text-fg-subtle text-xs">Los medios creados aquí se sincronizan al POS según la sucursal asignada.</p>
            <Button size="sm" onClick={() => setModalOpen(true)}>Crear el primero</Button>
          </div>
        ) : (
          <DataTable columns={columns} data={methods} keyExtractor={r => r.id} />
        )}
      </div>

      <MedioPagoModal
        key={editing?.id ?? 'new'}
        open={modalOpen || editing !== null}
        onOpenChange={open => {
          if (!open) { setModalOpen(false); setEditing(null) }
        }}
        editing={editing}
        onSaved={() => setRefresh(r => r + 1)}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={open => { if (!open) setDeleting(null) }}
        title="Eliminar medio de pago"
        description={`¿Eliminar "${deleting?.name}"? Se quitará de todas las sucursales asignadas.`}
        variant="danger"
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
      />
    </>
  )
}
