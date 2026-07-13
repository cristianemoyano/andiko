'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifyApiError, notifySuccess } from '@/lib/notify'
import { AutomationTaskDialog } from '../AutomationTaskDialog'
import type { ScheduledTaskRow, ScheduledTaskRunRow } from '../types'

const PAGE_SIZE = 20

const STATUS_LABELS: Record<ScheduledTaskRow['status'], { label: string; status: 'success' | 'pending' | 'draft' }> = {
  active: { label: 'Activa', status: 'success' },
  paused: { label: 'Pausada', status: 'pending' },
  disabled: { label: 'Deshabilitada', status: 'draft' },
}

const RUN_STATUS_LABELS: Record<ScheduledTaskRunRow['status'], { label: string; status: 'success' | 'error' | 'neutral' | 'pending' }> = {
  running: { label: 'En curso', status: 'pending' },
  success: { label: 'OK', status: 'success' },
  failed: { label: 'Falló', status: 'error' },
  skipped: { label: 'Omitida', status: 'neutral' },
}

const TRIGGER_LABELS: Record<ScheduledTaskRunRow['trigger_kind'], string> = {
  scheduled: 'Programada',
  manual: 'Manual',
}

export function AutomationDetailClient({ taskId }: { taskId: string }) {
  const [task, setTask] = useState<ScheduledTaskRow | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [runs, setRuns] = useState<ScheduledTaskRunRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoadError(null)
      try {
        const data = await fetchJson<ScheduledTaskRow>(`/api/v1/automations/${taskId}`)
        if (mounted) setTask(data)
      } catch (e) {
        if (mounted) setLoadError(getApiErrorMessage(e))
      }
    })()
    return () => { mounted = false }
  }, [taskId, refresh])

  useEffect(() => {
    let mounted = true
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    ;(async () => {
      try {
        const data = await fetchJson<{ data: ScheduledTaskRunRow[]; total: number }>(`/api/v1/automations/${taskId}/runs?${params}`)
        if (!mounted) return
        setRuns(Array.isArray(data?.data) ? data.data : [])
        setTotal(typeof data?.total === 'number' ? data.total : 0)
      } catch (e) {
        if (!mounted) return
        notifyApiError(e)
      }
    })()
    return () => { mounted = false }
  }, [taskId, page, refresh])

  async function handleRunNow() {
    if (!task) return
    setRunning(true)
    try {
      const result = await fetchJson<{ status: string }>(`/api/v1/automations/${task.id}/run`, { method: 'POST' })
      if (result.status === 'success') notifySuccess('Ejecutada correctamente')
      else if (result.status === 'skipped') notifySuccess('Ya había una ejecución en curso')
      else notifyApiError(new Error('La ejecución falló. Revisá el detalle abajo.'))
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    } finally {
      setRunning(false)
    }
  }

  const columns: Column<ScheduledTaskRunRow>[] = [
    {
      key: 'started_at',
      header: 'Inicio',
      render: row => <span className="text-[13px] text-fg-muted">{new Date(row.started_at).toLocaleString('es-AR')}</span>,
    },
    {
      key: 'trigger_kind',
      header: 'Disparo',
      render: row => <span className="text-[13px] text-fg-muted">{TRIGGER_LABELS[row.trigger_kind]}</span>,
    },
    {
      key: 'duration_ms',
      header: 'Duración',
      render: row => <span className="text-[13px] text-fg-muted">{row.duration_ms != null ? `${row.duration_ms} ms` : '—'}</span>,
    },
    {
      key: 'status',
      header: 'Resultado',
      render: row => <Badge status={RUN_STATUS_LABELS[row.status].status} dot>{RUN_STATUS_LABELS[row.status].label}</Badge>,
    },
    {
      key: 'error',
      header: 'Detalle',
      render: row => row.error
        ? <span className="text-[12px] text-danger">{row.error}</span>
        : <span className="text-[12px] text-fg-subtle">{row.result ? JSON.stringify(row.result) : '—'}</span>,
    },
  ]

  if (loadError) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Automatizaciones', href: '/automatizaciones' }, { label: 'Detalle' }]} />
        <PageBody>
          <div className="rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">{loadError}</div>
        </PageBody>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Automatizaciones', href: '/automatizaciones' }, { label: task?.name ?? '…' }]}
        actions={
          task ? (
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setDialogOpen(true)}>
                Editar
              </Button>
              <Button size="sm" onClick={handleRunNow} disabled={running}>
                {running ? 'Ejecutando…' : 'Ejecutar ahora'}
              </Button>
            </div>
          ) : undefined
        }
      />

      <PageBody>
        {task && (
          <div className="mb-6 flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
            <div className="flex items-center gap-2">
              <Badge status={STATUS_LABELS[task.status].status} dot>{STATUS_LABELS[task.status].label}</Badge>
              <span className="font-mono text-[12px] text-fg-muted">{task.cron_expression}</span>
              <span className="text-[12px] text-fg-subtle">({task.timezone})</span>
            </div>
            {task.description && <p className="text-sm text-fg-muted">{task.description}</p>}
            <div className="flex gap-6 text-[12px] text-fg-subtle">
              <span>Acción: {task.action_type}</span>
              <span>Próxima ejecución: {new Date(task.next_run_at).toLocaleString('es-AR')}</span>
              {task.consecutive_failures > 0 && (
                <span className="text-danger">Fallos consecutivos: {task.consecutive_failures}/{task.max_consecutive_failures}</span>
              )}
            </div>
          </div>
        )}

        <h2 className="mb-2 text-sm font-medium text-fg">Historial de ejecuciones</h2>
        <DataTable
          columns={columns}
          data={runs}
          keyExtractor={r => r.id}
          emptyMessage="Todavía no se ejecutó esta automatización."
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
        task={task}
        onSaved={() => setRefresh(r => r + 1)}
      />
    </div>
  )
}
