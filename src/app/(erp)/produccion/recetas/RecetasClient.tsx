'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { ProduccionSubNav } from '../ProduccionSubNav'
import { BomModal } from './BomModal'
import type { Bom } from '../types'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { useDebouncedValue } from '@/lib/use-debounced-value'

const PAGE_SIZE = 20

export function RecetasClient() {
  const [boms, setBoms]       = useState<Bom[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [search, setSearch]   = useState('')
  const [error, setError]     = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)

  const [modalOpen, setModalOpen]   = useState(false)
  const [editingBom, setEditingBom] = useState<Bom | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<Bom | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const debouncedSearch = useDebouncedValue(search, 300)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (debouncedSearch) params.set('search', debouncedSearch)
    ;(async () => {
      try {
        const d = await fetchJson<{ data: Bom[]; total: number }>(
          `/api/v1/production/boms?${params}`,
          { signal: controller.signal },
        )
        setBoms(d.data ?? [])
        setTotal(d.total ?? 0)
        setError(null)
      } catch (e) {
        if (controller.signal.aborted) return
        setError(getApiErrorMessage(e))
        setBoms([])
        setTotal(0)
      }
    })()
    return () => { controller.abort() }
  }, [page, debouncedSearch, refresh])

  async function handleDeactivate() {
    if (!deactivateTarget) return
    setActionError(null)
    try {
      await fetchJson(`/api/v1/production/boms/${deactivateTarget.id}`, { method: 'DELETE' })
      setDeactivateTarget(null)
      setRefresh(r => r + 1)
    } catch (e) {
      setActionError(getApiErrorMessage(e))
    }
  }

  const COLUMNS: Column<Bom>[] = [
    {
      key: 'name',
      header: 'Receta',
      render: row => <span className="font-medium text-fg">{row.name}</span>,
    },
    {
      key: 'variant',
      header: 'Producto terminado',
      render: row => row.variant?.product?.name ?? row.variant?.name ?? row.variant?.sku ?? '—',
    },
    {
      key: 'items',
      header: 'Componentes',
      render: row => <span className="text-fg-muted">{row.items?.length ?? 0}</span>,
    },
    {
      key: 'output_quantity',
      header: 'Rinde',
      render: row => <span className="tabular-nums">{parseFloat(row.output_quantity).toLocaleString('es-AR')}</span>,
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
      render: row => row.is_active ? (
        <button
          onClick={e => { e.stopPropagation(); setDeactivateTarget(row) }}
          className="text-[12px] text-danger hover:underline"
        >
          Desactivar
        </button>
      ) : null,
    },
  ]

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Producción', href: '/produccion' }, { label: 'Recetas (BOM)' }]}
        actions={
          <Button size="sm" onClick={() => { setEditingBom(null); setModalOpen(true) }}>
            Nueva receta
          </Button>
        }
      />
      <ProduccionSubNav />

      <PageBody>
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        {actionError && <p className="mb-3 text-sm text-danger">{actionError}</p>}
        <DataTable
          columns={COLUMNS}
          data={boms}
          keyExtractor={row => row.id}
          onRowClick={row => { setEditingBom(row); setModalOpen(true) }}
          emptyMessage="No hay recetas creadas"
          toolbar={
            <>
              <div className="relative flex items-center w-full sm:w-auto">
                <svg className="absolute left-2 text-fg-subtle pointer-events-none" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/>
                </svg>
                <input
                  type="text"
                  placeholder="Buscar receta…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  className="pl-7 pr-3 h-[30px] text-[13px] border border-border-strong rounded-sm w-full sm:w-52 bg-surface focus:outline-none focus:border-ring"
                />
              </div>
              <span className="flex-1" />
              <span className="text-[12px] text-fg-muted">{total} registro{total !== 1 ? 's' : ''}</span>
            </>
          }
          footer={
            total > 0 ? (
              <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            ) : undefined
          }
        />
      </PageBody>

      <BomModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        bom={editingBom}
        onSaved={() => setRefresh(r => r + 1)}
      />

      <ConfirmDialog
        open={!!deactivateTarget}
        onOpenChange={open => { if (!open) setDeactivateTarget(null) }}
        title="Desactivar receta"
        description={`¿Estás seguro de que querés desactivar la receta "${deactivateTarget?.name}"?`}
        variant="danger"
        confirmLabel="Desactivar"
        onConfirm={handleDeactivate}
      />
    </div>
  )
}
