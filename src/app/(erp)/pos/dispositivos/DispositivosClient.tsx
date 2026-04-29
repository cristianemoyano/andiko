'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { DataTable, type Column, ConfirmDialog } from '@/components/erp'
import { StatusBadge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { DeviceModal } from './DeviceModal'
import { DeviceEditModal } from './DeviceEditModal'
import { fetchJson } from '@/lib/fetch-json'
import { notifyApiError, notifySuccess } from '@/lib/notify'

type PosDevice = {
  id: string
  device_id: string
  name: string | null
  branch_id: string | null
  is_active: boolean
  last_seen_at: string | null
  license_valid_until: string | null
  created_at: string
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function DispositivosClient() {
  const [devices, setDevices] = useState<PosDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PosDevice | null>(null)
  const [deleting, setDeleting] = useState<PosDevice | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setLoading before async fetch is the standard pattern here
    setLoading(true)
    fetchJson<{ data: PosDevice[] }>('/api/v1/pos/devices')
      .then(res => setDevices(res.data))
      .catch(err => notifyApiError(err))
      .finally(() => setLoading(false))
  }, [refresh])

  async function handleDelete() {
    if (!deleting) return
    try {
      await fetchJson(`/api/v1/pos/devices/${deleting.id}`, { method: 'DELETE' })
      notifySuccess('Dispositivo eliminado')
      setRefresh(r => r + 1)
    } catch (err) {
      notifyApiError(err)
    } finally {
      setDeleting(null)
    }
  }

  const actionCol: Column<PosDevice> = {
    key: 'id',
    header: '',
    render: row => (
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => setEditing(row)}>
          Editar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setDeleting(row)}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          Eliminar
        </Button>
      </div>
    ),
  }

  const columns: Column<PosDevice>[] = [
    {
      key: 'device_id',
      header: 'Dispositivo',
      render: row => (
        <div>
          <span className="font-mono text-sm text-zinc-900">{row.device_id}</span>
          {row.name && <p className="text-xs text-zinc-500">{row.name}</p>}
        </div>
      ),
    },
    {
      key: 'is_active',
      header: 'Estado',
      render: row => <StatusBadge value={row.is_active ? 'Activo' : 'Inactivo'} />,
    },
    {
      key: 'last_seen_at',
      header: 'Última conexión',
      render: row => <span className="text-sm text-zinc-600">{formatDate(row.last_seen_at)}</span>,
    },
    {
      key: 'license_valid_until',
      header: 'Licencia hasta',
      render: row => {
        if (!row.license_valid_until) return <span className="text-zinc-400 text-sm">—</span>
        const expired = new Date(row.license_valid_until) < new Date()
        return (
          <span className={`text-sm ${expired ? 'text-red-600 font-medium' : 'text-zinc-600'}`}>
            {formatDate(row.license_valid_until)}
            {expired && ' (vencida)'}
          </span>
        )
      },
    },
    {
      key: 'created_at',
      header: 'Registrado',
      render: row => <span className="text-sm text-zinc-500">{formatDate(row.created_at)}</span>,
    },
    actionCol,
  ]

  return (
    <>
      <TopBar
        breadcrumbs={[{ label: 'POS' }, { label: 'Dispositivos' }]}
        actions={
          <Button size="sm" onClick={() => setModalOpen(true)}>
            + Registrar dispositivo
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-zinc-400 text-sm">Cargando…</div>
        ) : devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <p className="text-zinc-500 text-sm">No hay dispositivos registrados.</p>
            <Button size="sm" onClick={() => setModalOpen(true)}>Registrar el primero</Button>
          </div>
        ) : (
          <DataTable columns={columns} data={devices} keyExtractor={r => r.id} />
        )}
      </div>

      <DeviceModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onCreated={() => setRefresh(r => r + 1)}
      />

      <DeviceEditModal
        device={editing}
        onOpenChange={open => { if (!open) setEditing(null) }}
        onSaved={() => setRefresh(r => r + 1)}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={open => { if (!open) setDeleting(null) }}
        title="Eliminar dispositivo"
        description={`¿Eliminar permanentemente "${deleting?.name ?? deleting?.device_id}"? El POS no podrá autenticarse más.`}
        variant="danger"
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
      />
    </>
  )
}
