'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { ExpensasSubNav } from '../ExpensasSubNav'
import { RecurringExpenseTemplateModal } from './RecurringExpenseTemplateModal'
import type { RecurringExpenseTemplate } from '../types'
import { RECURRING_FREQUENCY_LABEL } from '../types'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifyApiError, notifySuccess } from '@/lib/notify'

const PAGE_SIZE = 20

export function RecurrentesClient() {
  const router = useRouter()
  const [rows, setRows]     = useState<RecurringExpenseTemplate[]>([])
  const [total, setTotal]   = useState(0)
  const [page, setPage]     = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [listError, setListError] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing]       = useState<RecurringExpenseTemplate | null>(null)
  const [deleting, setDeleting]     = useState<RecurringExpenseTemplate | null>(null)

  useEffect(() => {
    let mounted = true
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    ;(async () => {
      setListError(null)
      try {
        const data = await fetchJson<{ data: RecurringExpenseTemplate[]; total: number }>(
          `/api/v1/expenses/recurring-templates?${params}`,
        )
        if (!mounted) return
        setRows(data.data ?? [])
        setTotal(data.total ?? 0)
      } catch (e) {
        if (!mounted) return
        setListError(getApiErrorMessage(e))
        setRows([])
        setTotal(0)
      }
    })()
    return () => { mounted = false }
  }, [page, refresh])

  function openEdit(row: RecurringExpenseTemplate) {
    setEditing(row)
    setDialogOpen(true)
  }

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  async function handleDelete() {
    if (!deleting) return
    const target = deleting
    setDeleting(null)
    try {
      await fetchJson(`/api/v1/expenses/recurring-templates/${target.id}`, { method: 'DELETE' })
      notifySuccess(`Plantilla «${target.description}» eliminada`)
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    }
  }

  const columns: Column<RecurringExpenseTemplate>[] = [
    {
      key: 'description',
      header: 'Descripción',
      render: row => (
        <div className="flex flex-col">
          <span className="font-medium text-fg">{row.description}</span>
          <span className="text-[12px] text-fg-subtle">{row.expense_account_code}</span>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Proveedor',
      render: row => row.contact ? <span className="text-fg-muted">{row.contact.legal_name}</span> : <span className="text-fg-subtle">—</span>,
    },
    {
      key: 'default_amount',
      header: 'Monto',
      render: row => <span className="tabular-nums font-medium">{formatARS(row.default_amount)}</span>,
    },
    {
      key: 'frequency',
      header: 'Frecuencia',
      render: row => RECURRING_FREQUENCY_LABEL[row.frequency],
    },
    {
      key: 'next_run_date',
      header: 'Próxima generación',
      render: row => new Date(row.next_run_date).toLocaleDateString('es-AR'),
    },
    {
      key: 'is_active',
      header: 'Estado',
      render: row => row.is_active
        ? <Badge status="success" dot>Activa</Badge>
        : <Badge status="draft" dot>Inactiva</Badge>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      className: 'w-[160px]',
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
        breadcrumbs={[{ label: 'Expensas', href: '/expensas' }, { label: 'Recurrentes' }]}
        actions={
          <Button size="sm" onClick={openCreate}>
            + Gasto recurrente
          </Button>
        }
      />
      <ExpensasSubNav />

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
          emptyMessage="No hay gastos recurrentes configurados. Creá uno para generar facturas automáticamente cada período (alquiler, servicios, etc.)."
          onRowClick={row => router.push(`/expensas/facturas/nueva?template_id=${row.id}`)}
          footer={
            total > 0 ? (
              <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            ) : undefined
          }
        />
      </PageBody>

      <RecurringExpenseTemplateModal
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        template={editing}
        onSaved={() => setRefresh(r => r + 1)}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={open => { if (!open) setDeleting(null) }}
        title="Eliminar gasto recurrente"
        description={`¿Eliminar «${deleting?.description ?? ''}»? No se eliminan las facturas ya generadas.`}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDelete}
      />
    </div>
  )
}
