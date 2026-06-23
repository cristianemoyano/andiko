'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
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
  punto_venta: number | null
  created_at: string
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const TUTORIAL_STEPS = [
  {
    title: 'Registrar la terminal',
    body: 'Creá un dispositivo por cada caja o PC con POS. Asignale nombre y sucursal. El token de API se muestra una sola vez al crearlo — copialo antes de cerrar.',
  },
  {
    title: 'Configurar el POS',
    body: 'En el punto de venta, ingresá la URL de tu instancia Andiko y el token que copiaste al crear el dispositivo. Validá la licencia para vincular la sucursal.',
  },
  {
    title: 'Sincronizar datos',
    body: 'Usá Sincronizar datos del cloud para traer productos, clientes, medios de pago y configuración de balanza. Repetí después de cambios en el ERP.',
  },
  {
    title: 'Mantener la licencia',
    body: 'Cada validación renueva la licencia por 30 días. Sin conexión el POS opera en modo offline con un período de gracia; después debe reconectar.',
  },
] as const

function DispositivosTutorialPanel() {
  return (
    <div className="bg-surface border border-border rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-surface-muted/30">
        <h2 className="text-sm font-semibold text-fg">Cómo funciona</h2>
        <p className="text-xs text-fg-subtle mt-1 leading-relaxed">
          Guía para vincular una terminal POS con tu organización en el cloud.
        </p>
      </div>

      <ol className="p-5 space-y-4">
        {TUTORIAL_STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 text-[11px] font-semibold">
              {i + 1}
            </span>
            <div className="min-w-0 pt-0.5">
              <div className="text-[13px] font-medium text-fg">{step.title}</div>
              <p className="text-xs text-fg-muted mt-1 leading-relaxed">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="px-5 pb-5">
        <p className="text-[11px] text-fg-subtle leading-relaxed">
          Desactivá un dispositivo para revocar el acceso sin borrar el historial. Eliminarlo es permanente
          y el token deja de funcionar de inmediato.
        </p>
      </div>
    </div>
  )
}

function DispositivosContent({
  loading,
  devices,
  columns,
  onRegister,
}: {
  loading: boolean
  devices: PosDevice[]
  columns: Column<PosDevice>[]
  onRegister: () => void
}) {
  if (loading) {
    return <div className="flex items-center justify-center h-40 text-fg-subtle text-sm">Cargando…</div>
  }

  if (devices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2">
        <p className="text-fg-muted text-sm">No hay dispositivos registrados.</p>
        <Button size="sm" onClick={onRegister}>Registrar el primero</Button>
      </div>
    )
  }

  return <DataTable columns={columns} data={devices} keyExtractor={r => r.id} />
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
          className="text-danger hover:text-danger hover:bg-danger-bg"
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
          <span className="font-mono text-sm text-fg">{row.device_id}</span>
          {row.name && <p className="text-xs text-fg-muted">{row.name}</p>}
        </div>
      ),
    },
    {
      key: 'is_active',
      header: 'Estado',
      render: row => <StatusBadge value={row.is_active ? 'Activo' : 'Inactivo'} />,
    },
    {
      key: 'punto_venta',
      header: 'P.V. fiscal',
      render: row => (
        <span className="text-sm tabular-nums text-fg-muted">
          {row.punto_venta != null ? String(row.punto_venta).padStart(4, '0') : 'Sucursal'}
        </span>
      ),
    },
    {
      key: 'last_seen_at',
      header: 'Última conexión',
      render: row => <span className="text-sm text-fg-muted">{formatDate(row.last_seen_at)}</span>,
    },
    {
      key: 'license_valid_until',
      header: 'Licencia hasta',
      render: row => {
        if (!row.license_valid_until) return <span className="text-fg-subtle text-sm">—</span>
        const expired = new Date(row.license_valid_until) < new Date()
        return (
          <span className={`text-sm ${expired ? 'text-danger font-medium' : 'text-fg-muted'}`}>
            {formatDate(row.license_valid_until)}
            {expired && ' (vencida)'}
          </span>
        )
      },
    },
    {
      key: 'created_at',
      header: 'Registrado',
      render: row => <span className="text-sm text-fg-muted">{formatDate(row.created_at)}</span>,
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

      <PageBody padding="p-6">
        <div className="max-w-6xl grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] gap-6 items-start">
          <div className="bg-surface border border-border rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.06)] divide-y divide-border min-w-0 overflow-hidden">
            <section className="px-5 py-4 bg-surface-muted/30">
              <p className="text-sm text-fg-muted leading-relaxed">
                Cada terminal POS (caja, mostrador) se registra acá y recibe un token único. Ese token
                identifica el dispositivo ante el cloud y define a qué sucursal pertenece.
              </p>
            </section>
            <section className="min-w-0">
              <DispositivosContent
                loading={loading}
                devices={devices}
                columns={columns}
                onRegister={() => setModalOpen(true)}
              />
            </section>
          </div>

          <aside className="min-w-0 xl:sticky xl:top-6">
            <DispositivosTutorialPanel />
          </aside>
        </div>
      </PageBody>

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
