'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { StatusBadge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/primitives/DropdownMenu'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { CampaignModal, type CampaignRow } from './CampaignModal'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifyApiError, notifySuccess } from '@/lib/notify'
import { useDebouncedValue } from '@/lib/use-debounced-value'

const PAGE_SIZE = 20

function formatDate(value: string): string {
  const d = new Date(value)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function rewardLabel(row: CampaignRow): string {
  if (row.reward_kind === 'installments') {
    return `${row.installments_count ?? ''} cuotas${row.installments_interest_free ? ' sin interés' : ''}`
  }
  return `${row.reward_percent ?? '0'}% de descuento`
}

const COLUMNS: Column<CampaignRow>[] = [
  {
    key: 'name',
    header: 'Campaña',
    sortable: true,
    render: (row) => (
      <span className="inline-flex items-center gap-2 font-medium text-fg" data-testid="campaign-row" data-campaign-name={row.name}>
        {row.name}
        {row.requires_coupon && (
          <span className="rounded-sm border border-border bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-fg-muted">
            Cupón
          </span>
        )}
      </span>
    ),
  },
  { key: 'reward', header: 'Beneficio', render: (row) => rewardLabel(row) },
  {
    key: 'vigencia',
    header: 'Vigencia',
    render: (row) => (
      <span className="text-[12px] text-fg-muted">{formatDate(row.valid_from)} — {formatDate(row.valid_to)}</span>
    ),
  },
  {
    key: 'is_active',
    header: 'Estado',
    render: (row) => <StatusBadge value={row.is_active ? 'Aprobado' : 'Anulado'} />,
  },
]

export function CampanasClient() {
  const [rows, setRows] = useState<CampaignRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<CampaignRow | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const debouncedSearch = useDebouncedValue(search, 300)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    })
    ;(async () => {
      setServerError(null)
      try {
        const data = await fetchJson<{ data: CampaignRow[]; total: number }>(
          `/api/v1/campaigns?${params}`,
          { signal: controller.signal },
        )
        setRows(data.data)
        setTotal(data.total)
      } catch (e) {
        if (controller.signal.aborted) return
        setServerError(getApiErrorMessage(e))
        setRows([])
        setTotal(0)
      }
    })()
    return () => { controller.abort() }
  }, [page, debouncedSearch, refresh])

  function openCreate() {
    setEditingId(null)
    setModalOpen(true)
  }

  function openEdit(row: CampaignRow) {
    setEditingId(row.id)
    setModalOpen(true)
  }

  function handleSaved() {
    const wasEdit = !!editingId
    setModalOpen(false)
    setEditingId(null)
    setRefresh((r) => r + 1)
    notifySuccess(wasEdit ? 'Campaña actualizada' : 'Campaña creada')
  }

  async function toggleActive(row: CampaignRow) {
    try {
      await fetchJson(`/api/v1/campaigns/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !row.is_active }),
      })
      notifySuccess(row.is_active ? 'Campaña desactivada' : 'Campaña activada')
      setRefresh((r) => r + 1)
    } catch (e) {
      notifyApiError(e)
    }
  }

  async function handleDelete() {
    if (!toDelete) return
    try {
      await fetchJson(`/api/v1/campaigns/${toDelete.id}`, { method: 'DELETE' })
      setToDelete(null)
      notifySuccess('Campaña eliminada')
      setRefresh((r) => r + 1)
    } catch (e) {
      notifyApiError(e)
    }
  }

  const columnsWithAction: Column<CampaignRow>[] = [
    ...COLUMNS,
    {
      key: '_actions',
      header: '',
      className: 'w-[64px]',
      mobileRole: 'actions' as const,
      render: (row) => (
        <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="xs" aria-label="Más acciones" className="px-1.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
                </svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => openEdit(row)}>Editar</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => toggleActive(row)}>
                {row.is_active ? 'Desactivar' : 'Activar'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(row)}>Eliminar</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
      mobileRender: (row) => (
        <>
          <DropdownMenuItem onSelect={() => openEdit(row)}>Editar</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => toggleActive(row)}>{row.is_active ? 'Desactivar' : 'Activar'}</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(row)}>Eliminar</DropdownMenuItem>
        </>
      ),
    },
  ]

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Campañas' }]}
        actions={
          <Button size="sm" data-testid="new-campaign-btn" onClick={openCreate}>
            + Nueva campaña
          </Button>
        }
      />

      <PageBody onRefresh={async () => setRefresh((r) => r + 1)}>
        {serverError && (
          <div className="mb-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
            {serverError}
          </div>
        )}
        <DataTable
          columns={columnsWithAction}
          data={rows}
          keyExtractor={(r) => r.id}
          onRowClick={(row) => openEdit(row)}
          emptyMessage="No hay campañas. Creá la primera."
          toolbar={
            <>
              <div className="relative flex items-center w-full sm:w-auto">
                <svg className="absolute left-2 text-fg-subtle pointer-events-none" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5l3 3" />
                </svg>
                <input
                  data-testid="campaign-search-input"
                  className="pl-7 pr-3 h-[30px] text-[13px] border border-border-strong rounded-sm w-full sm:w-52 bg-surface focus:outline-none focus:border-ring"
                  placeholder="Buscar por nombre…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                />
              </div>
              <span className="flex-1" />
              <span className="text-[12px] text-fg-muted">{total} campaña{total !== 1 ? 's' : ''}</span>
            </>
          }
          footer={
            total > 0 ? (
              <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            ) : undefined
          }
        />
      </PageBody>

      <CampaignModal
        open={modalOpen}
        campaignId={editingId}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => { if (!open) setToDelete(null) }}
        title="Eliminar campaña"
        description={toDelete ? `Se eliminará “${toDelete.name}”.` : ''}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDelete}
      />
    </div>
  )
}
