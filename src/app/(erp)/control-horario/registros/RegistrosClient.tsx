'use client'

import { useState, useEffect, useMemo } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Select } from '@/components/primitives/Select'
import { DatePicker } from '@/components/primitives/DatePicker'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifyApiError, notifySuccess } from '@/lib/notify'
import { formatLocalDateTime } from '@/lib/date-only'
import { resolveWorkDate } from '@/modules/attendance/attendance.utils'
import { ControlHorarioSubNav } from '../ControlHorarioSubNav'
import { AttendanceEventDialog } from './AttendanceEventDialog'
import { AttendanceImportDialog } from './AttendanceImportDialog'
import type { AttendanceEventRow, DailyTotal, EmployeeRow } from '../types'

const PAGE_SIZE = 20

const EVENT_LABEL: Record<string, string> = {
  clock_in: 'Entrada',
  clock_out: 'Salida',
  absence: 'Ausencia',
}

const SOURCE_LABEL: Record<string, string> = {
  self_service: 'Fichaje propio',
  manual: 'Carga manual',
  device_import: 'Reloj físico',
}

type BranchOption = { id: string; name: string; branch_code: number }

/** Argentina calendar day for the date range filters — must match the server's resolveWorkDate exactly. */
function toDateOnlyParam(d: Date): string {
  return resolveWorkDate(d)
}

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${String(m).padStart(2, '0')}m`
}

export function RegistrosClient() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [branches, setBranches] = useState<BranchOption[]>([])

  const [employeeFilter, setEmployeeFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [dateFrom, setDateFrom] = useState<Date>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 6)
    return d
  })
  const [dateTo, setDateTo] = useState<Date>(() => new Date())

  const [rows, setRows] = useState<AttendanceEventRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totals, setTotals] = useState<DailyTotal[]>([])
  const [listError, setListError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)

  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [deleting, setDeleting] = useState<AttendanceEventRow | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const [employeesRes, branchesRes] = await Promise.all([
          fetchJson<{ data: EmployeeRow[] }>('/api/v1/attendance/employees?limit=200'),
          fetchJson<{ data: BranchOption[] }>('/api/v1/branches?limit=100'),
        ])
        if (!mounted) return
        setEmployees(employeesRes.data ?? [])
        setBranches(branchesRes.data ?? [])
      } catch {
        if (!mounted) return
        setEmployees([])
        setBranches([])
      }
    })()
    return () => { mounted = false }
  }, [refresh])

  const employeeMap = useMemo(() => new Map(employees.map(e => [e.id, `${e.first_name} ${e.last_name}`])), [employees])
  const branchMap = useMemo(() => new Map(branches.map(b => [b.id, b.name])), [branches])

  useEffect(() => {
    let mounted = true
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
      date_from: toDateOnlyParam(dateFrom),
      date_to: toDateOnlyParam(dateTo),
    })
    if (employeeFilter) params.set('employee_id', employeeFilter)
    if (branchFilter) params.set('branch_id', branchFilter)

    ;(async () => {
      setListError(null)
      try {
        const data = await fetchJson<{ data: AttendanceEventRow[]; total: number }>(`/api/v1/attendance/events?${params}`)
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
  }, [page, employeeFilter, branchFilter, dateFrom, dateTo, refresh])

  useEffect(() => {
    let mounted = true
    const params = new URLSearchParams({
      date_from: toDateOnlyParam(dateFrom),
      date_to: toDateOnlyParam(dateTo),
    })
    if (employeeFilter) params.set('employee_id', employeeFilter)
    if (branchFilter) params.set('branch_id', branchFilter)

    ;(async () => {
      try {
        const res = await fetchJson<{ data: DailyTotal[] }>(`/api/v1/attendance/events/summary?${params}`)
        if (mounted) setTotals(res.data ?? [])
      } catch {
        if (mounted) setTotals([])
      }
    })()
    return () => { mounted = false }
  }, [employeeFilter, branchFilter, dateFrom, dateTo, refresh])

  async function handleDelete() {
    if (!deleting) return
    const target = deleting
    setDeleting(null)
    try {
      await fetchJson(`/api/v1/attendance/events/${target.id}`, { method: 'DELETE' })
      notifySuccess('Registro eliminado')
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    }
  }

  const columns: Column<AttendanceEventRow>[] = [
    {
      key: 'work_date',
      header: 'Fecha',
      render: row => <span className="tabular-nums text-[13px] text-fg">{row.work_date}</span>,
    },
    {
      key: 'employee',
      header: 'Empleado',
      render: row => <span className="text-[13px] text-fg">{employeeMap.get(row.employee_id) ?? '—'}</span>,
    },
    {
      key: 'event_type',
      header: 'Tipo',
      render: row => <span className="text-[13px] text-fg-muted">{EVENT_LABEL[row.event_type] ?? row.event_type}</span>,
    },
    {
      key: 'occurred_at',
      header: 'Fecha y hora',
      render: row => <span className="tabular-nums text-[12px] text-fg-muted">{formatLocalDateTime(row.occurred_at)}</span>,
    },
    {
      key: 'branch',
      header: 'Sucursal',
      render: row => <span className="text-[12px] text-fg-muted">{branchMap.get(row.branch_id) ?? '—'}</span>,
    },
    {
      key: 'source',
      header: 'Origen',
      render: row => (
        <Badge status={row.source === 'self_service' ? 'info' : row.source === 'device_import' ? 'success' : 'neutral'}>
          {SOURCE_LABEL[row.source] ?? row.source}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      className: 'w-[80px]',
      mobileRole: 'actions',
      render: row => (
        <div className="flex items-center justify-end" data-stop-row-click onClick={e => e.stopPropagation()}>
          <Button variant="ghost" size="xs" onClick={() => setDeleting(row)}>Eliminar</Button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Control de Horario', href: '/control-horario' }, { label: 'Registros' }]}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>Importar desde reloj</Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>+ Nuevo registro</Button>
          </div>
        }
      />
      <ControlHorarioSubNav />

      <PageBody>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="w-48">
            <Select
              value={employeeFilter}
              onChange={setEmployeeFilter}
              options={[{ value: '', label: 'Todos los empleados' }, ...employees.map(e => ({ value: e.id, label: `${e.first_name} ${e.last_name}` }))]}
            />
          </div>
          <div className="w-40">
            <Select
              value={branchFilter}
              onChange={setBranchFilter}
              options={[{ value: '', label: 'Todas las sucursales' }, ...branches.map(b => ({ value: b.id, label: b.name }))]}
            />
          </div>
          <div className="flex items-center gap-2">
            <DatePicker value={dateFrom} onChange={d => { if (d) { setDateFrom(d); setPage(1) } }} />
            <span className="text-fg-subtle">—</span>
            <DatePicker value={dateTo} onChange={d => { if (d) { setDateTo(d); setPage(1) } }} />
          </div>
        </div>

        {totals.length > 0 && (
          <div className="mb-4 flex flex-col gap-1.5">
            <p className="text-[12px] font-medium text-fg-muted">Totales por día</p>
            <div className="flex flex-wrap gap-2">
              {totals.map(t => (
                <div
                  key={`${t.employee_id}-${t.work_date}`}
                  className="flex items-center gap-2 rounded-sm border border-border bg-surface px-2.5 py-1.5 text-[12px]"
                >
                  <span className="font-medium text-fg">{employeeMap.get(t.employee_id) ?? '—'}</span>
                  <span className="text-fg-subtle">{t.work_date}</span>
                  <span className="tabular-nums text-fg-muted">{formatMinutes(t.worked_minutes)}</span>
                  {t.is_open && <Badge status="info" dot>Abierto</Badge>}
                  {t.has_absence && <Badge status="pending">Ausencia</Badge>}
                  {t.anomalies.length > 0 && <Badge status="error">Revisar</Badge>}
                </div>
              ))}
            </div>
          </div>
        )}

        {listError && (
          <div className="mb-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
            {listError}
          </div>
        )}

        <DataTable
          columns={columns}
          data={rows}
          keyExtractor={r => r.id}
          emptyMessage="No hay fichadas en el rango seleccionado."
          footer={
            total > 0 ? (
              <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            ) : undefined
          }
        />
      </PageBody>

      <AttendanceEventDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        employees={employees}
        branches={branches}
        onSaved={() => setRefresh(r => r + 1)}
      />

      <AttendanceImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        branches={branches}
        onImported={() => setRefresh(r => r + 1)}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => { if (!open) setDeleting(null) }}
        title="Eliminar registro"
        description="¿Eliminar esta fichada? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDelete}
      />
    </div>
  )
}
