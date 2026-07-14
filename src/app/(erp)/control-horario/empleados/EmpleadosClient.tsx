'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, TablePagination, ImportModal, type Column } from '@/components/erp'
import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifyApiError, notifySuccess } from '@/lib/notify'
import {
  EMPLOYEE_CSV_HEADERS,
  EMPLOYEE_CSV_REQUIRED_FIELDS,
} from '@/modules/attendance/employees-csv-adapter'
import { ControlHorarioSubNav } from '../ControlHorarioSubNav'
import { EmployeeDialog } from './EmployeeDialog'
import type { EmployeeRow } from '../types'

const PAGE_SIZE = 20

type BranchOption = { id: string; name: string; branch_code: number }

export function EmpleadosClient() {
  const [rows, setRows] = useState<EmployeeRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [listError, setListError] = useState<string | null>(null)
  const [branches, setBranches] = useState<BranchOption[]>([])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<EmployeeRow | null>(null)
  const [deleting, setDeleting] = useState<EmployeeRow | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importSession, setImportSession] = useState(0)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetchJson<{ data: BranchOption[] }>('/api/v1/branches?limit=100')
        if (mounted) setBranches(res.data ?? [])
      } catch {
        if (mounted) setBranches([])
      }
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let mounted = true
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (search.trim()) params.set('search', search.trim())
    ;(async () => {
      setListError(null)
      try {
        const data = await fetchJson<{ data: EmployeeRow[]; total: number }>(`/api/v1/attendance/employees?${params}`)
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
  }, [page, search, refresh])

  async function handleDelete() {
    if (!deleting) return
    const target = deleting
    setDeleting(null)
    try {
      await fetchJson(`/api/v1/attendance/employees/${target.id}`, { method: 'DELETE' })
      notifySuccess(`Empleado «${target.first_name} ${target.last_name}» eliminado`)
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    }
  }

  function openEdit(row: EmployeeRow) {
    setEditing(row)
    setDialogOpen(true)
  }

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openImport() {
    setImportSession(s => s + 1)
    setImportOpen(true)
  }

  function branchLabel(branchId: string): string {
    const b = branches.find(x => x.id === branchId)
    return b ? `${String(b.branch_code).padStart(2, '0')} — ${b.name}` : '—'
  }

  const columns: Column<EmployeeRow>[] = [
    {
      key: 'name',
      header: 'Empleado',
      render: row => (
        <div className="flex flex-col">
          <span className="font-medium text-fg">{row.first_name} {row.last_name}</span>
          {row.position && <span className="text-[12px] text-fg-muted">{row.position}</span>}
        </div>
      ),
    },
    {
      key: 'branch',
      header: 'Sucursal',
      render: row => <span className="text-[13px] text-fg-muted">{branchLabel(row.branch_id)}</span>,
    },
    {
      key: 'cuil',
      header: 'CUIL',
      render: row => row.cuil
        ? <span className="font-mono text-[12px] text-fg-muted">{row.cuil}</span>
        : <span className="text-fg-subtle">—</span>,
    },
    {
      key: 'user_id',
      header: 'Acceso al sistema',
      render: row => row.user_id
        ? <Badge status="info" dot>Vinculado</Badge>
        : <Badge status="neutral">Sin acceso</Badge>,
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
        <div className="flex items-center justify-end gap-1" data-stop-row-click onClick={e => e.stopPropagation()}>
          <Button variant="secondary" size="xs" onClick={() => openEdit(row)}>Editar</Button>
          <Button variant="ghost" size="xs" onClick={() => setDeleting(row)}>Eliminar</Button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Control de Horario', href: '/control-horario' }, { label: 'Empleados' }]}
        actions={(
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={openImport}>Importar CSV</Button>
            <Button size="sm" onClick={openCreate}>+ Nuevo empleado</Button>
          </div>
        )}
      />
      <ControlHorarioSubNav />

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
          emptyMessage="No hay empleados cargados todavía."
          toolbar={
            <div className="relative flex items-center w-full sm:w-auto">
              <svg className="absolute left-2 text-fg-subtle pointer-events-none" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/>
              </svg>
              <input
                className="pl-7 pr-3 h-[30px] text-[13px] border border-border-strong rounded-sm w-full sm:w-56 bg-surface focus:outline-none focus:border-ring"
                placeholder="Buscar por nombre, CUIL o código…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
              />
            </div>
          }
          footer={
            total > 0 ? (
              <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            ) : undefined
          }
        />
      </PageBody>

      <EmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employee={editing}
        onSaved={() => setRefresh(r => r + 1)}
      />

      <ImportModal
        key={importSession}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importar empleados"
        fields={EMPLOYEE_CSV_HEADERS}
        requiredFields={[...EMPLOYEE_CSV_REQUIRED_FIELDS]}
        importUrl="/api/v1/attendance/employees/import"
        confirmHint="El código de sucursal debe coincidir con el de Configuración. El código de legajo es el que usa el reloj biométrico al importar fichadas."
        onImported={() => {
          notifySuccess('Empleados importados correctamente')
          setRefresh(r => r + 1)
          setImportOpen(false)
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => { if (!open) setDeleting(null) }}
        title="Eliminar empleado"
        description={`¿Eliminar a «${deleting ? `${deleting.first_name} ${deleting.last_name}` : ''}»? Los registros de fichaje existentes se conservan como historial.`}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDelete}
      />
    </div>
  )
}
