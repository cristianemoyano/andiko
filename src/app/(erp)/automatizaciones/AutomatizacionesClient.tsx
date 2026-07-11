'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifyApiError, notifySuccess } from '@/lib/notify'
import { AutomationTaskDialog } from './AutomationTaskDialog'
import type { ScheduledTaskRow } from './types'

const PAGE_SIZE = 20

const STATUS_LABELS: Record<ScheduledTaskRow['status'], { label: string; status: 'success' | 'pending' | 'draft' }> = {
  active: { label: 'Activa', status: 'success' },
  paused: { label: 'Pausada', status: 'pending' },
  disabled: { label: 'Deshabilitada', status: 'draft' },
}

const RUN_STATUS_LABELS: Record<NonNullable<ScheduledTaskRow['last_run_status']>, { label: string; status: 'success' | 'error' | 'neutral' }> = {
  success: { label: 'OK', status: 'success' },
  failed: { label: 'Falló', status: 'error' },
  skipped: { label: 'Omitida', status: 'neutral' },
}

export function AutomatizacionesClient() {
  const router = useRouter()
  const [rows, setRows] = useState<ScheduledTaskRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [listError, setListError] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ScheduledTaskRow | null>(null)
  const [deleting, setDeleting] = useState<ScheduledTaskRow | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    ;(async () => {
      setListError(null)
      try {
        const data = await fetchJson<{ data: ScheduledTaskRow[]; total: number }>(`/api/v1/automations?${params}`)
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
      await fetchJson(`/api/v1/automations/${target.id}`, { method: 'DELETE' })
      notifySuccess(`Automatización «${target.name}» eliminada`)
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    }
  }

  async function handleRunNow(row: ScheduledTaskRow) {
    setRunningId(row.id)
    try {
      const result = await fetchJson<{ status: string }>(`/api/v1/automations/${row.id}/run`, { method: 'POST' })
      if (result.status === 'success') notifySuccess(`«${row.name}» ejecutada correctamente`)
      else if (result.status === 'skipped') notifySuccess(`«${row.name}»: ya había una ejecución en curso`)
      else notifyApiError(new Error(`«${row.name}» falló. Revisá el historial.`))
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    } finally {
      setRunningId(null)
    }
  }

  function openEdit(row: ScheduledTaskRow) {
    setEditing(row)
    setDialogOpen(true)
  }

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  const columns: Column<ScheduledTaskRow>[] = [
    {
      key: 'name',
      header: 'Nombre',
      render: row => (
        <div className="flex flex-col">
          <span className="font-medium text-fg">{row.name}</span>
          <span className="text-[12px] text-fg-subtle">{row.action_type}</span>
        </div>
      ),
    },
    {
      key: 'cron_expression',
      header: 'Frecuencia',
      render: row => <span className="font-mono text-[12px] text-fg-muted">{row.cron_expression}</span>,
    },
    {
      key: 'next_run_at',
      header: 'Próxima ejecución',
      render: row => <span className="text-[13px] text-fg-muted">{new Date(row.next_run_at).toLocaleString('es-AR')}</span>,
    },
    {
      key: 'last_run_status',
      header: 'Último resultado',
      render: row => row.last_run_status
        ? <Badge status={RUN_STATUS_LABELS[row.last_run_status].status} dot>{RUN_STATUS_LABELS[row.last_run_status].label}</Badge>
        : <span className="text-fg-subtle">—</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      render: row => <Badge status={STATUS_LABELS[row.status].status} dot>{STATUS_LABELS[row.status].label}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      className: 'w-[220px]',
      mobileRole: 'actions',
      render: row => (
        <div
          className="flex items-center justify-end gap-1"
          data-stop-row-click
          onClick={e => e.stopPropagation()}
        >
          <Button variant="secondary" size="xs" onClick={() => handleRunNow(row)} disabled={runningId === row.id}>
            {runningId === row.id ? 'Ejecutando…' : 'Ejecutar ahora'}
          </Button>
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
        breadcrumbs={[{ label: 'Automatizaciones' }]}
        actions={
          <Button size="sm" onClick={openCreate}>
            + Nueva automatización
          </Button>
        }
      />

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
          emptyMessage="Todavía no creaste automatizaciones. Programá tareas recurrentes tipo cron para tu operación."
          onRowClick={row => router.push(`/automatizaciones/${row.id}`)}
          footer={
            total > 0 ? (
              <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            ) : undefined
          }
        />
      </PageBody>

      <AutomationTaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editing}
        onSaved={() => setRefresh(r => r + 1)}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => { if (!open) setDeleting(null) }}
        title="Eliminar automatización"
        description={`¿Eliminar «${deleting?.name ?? ''}»? Se conserva el historial de ejecuciones.`}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDelete}
      />
    </div>
  )
}
