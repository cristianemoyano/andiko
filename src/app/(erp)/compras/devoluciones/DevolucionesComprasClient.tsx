'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, DocumentStatusNav, TablePagination, type Column } from '@/components/erp'
import { StatusBadge } from '@/components/primitives/Badge'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { ComprasSubNav } from '../ComprasSubNav'
import { fetchJson } from '@/lib/fetch-json'

type ReturnRow = {
  id: string
  return_number: string
  operation_type: 'return' | 'exchange'
  status: 'draft' | 'confirmed' | 'completed' | 'cancelled'
  returned_total: string
  completed_at: string | null
  order: { id: string; order_number: string; status: string } | null
}

const RETURN_STATUS_LABEL: Record<ReturnRow['status'], string> = {
  draft:     'Borrador',
  confirmed: 'Confirmada',
  completed: 'Completada',
  cancelled: 'Anulada',
}

const OP_LABEL = { return: 'Devolución', exchange: 'Cambio' } as const

const PAGE_SIZE = 20
type ReturnStatusTab = ReturnRow['status'] | ''

const STATUS_TABS: readonly { key: ReturnStatusTab; label: string }[] = [
  { key: '',          label: 'Todas' },
  { key: 'draft',     label: 'Borrador' },
  { key: 'confirmed', label: 'Confirmada' },
  { key: 'completed', label: 'Completada' },
  { key: 'cancelled', label: 'Anulada' },
]

const EMPTY_STATUS_COUNTS: Record<ReturnStatusTab, number> = {
  '': 0,
  draft: 0,
  confirmed: 0,
  completed: 0,
  cancelled: 0,
}

export function DevolucionesComprasClient() {
  const router = useRouter()
  const [rows, setRows] = useState<ReturnRow[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<ReturnStatusTab>('')
  const [statusCounts, setStatusCounts] = useState(EMPTY_STATUS_COUNTS)
  const [listError, setListError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    void (async () => {
      setListError(null)
      try {
        const data = await fetchJson<{ data: ReturnRow[]; total: number }>(
          `/api/v1/purchases/returns?page=${page}&limit=${PAGE_SIZE}${status ? `&status=${status}` : ''}`,
        )
        if (!mounted) return
        setRows(data.data ?? [])
        setTotal(data.total ?? 0)
      } catch {
        if (!mounted) return
        setRows([])
        setTotal(0)
        setListError('No se pudieron cargar las devoluciones.')
      }
    })()
    return () => { mounted = false }
  }, [page, status])

  useEffect(() => {
    const controller = new AbortController()
    void fetchJson<{ data: Record<ReturnStatusTab, number> }>(
      '/api/v1/purchases/returns/status-counts',
      { signal: controller.signal },
    )
      .then(response => setStatusCounts({ ...EMPTY_STATUS_COUNTS, ...(response.data ?? {}) }))
      .catch(() => {
        if (!controller.signal.aborted) setStatusCounts(EMPTY_STATUS_COUNTS)
      })
    return () => { controller.abort() }
  }, [])

  const columns: Column<ReturnRow>[] = [
    { key: 'return_number', header: 'Número', render: r => r.return_number },
    { key: 'operation_type', header: 'Tipo', render: r => OP_LABEL[r.operation_type] },
    { key: 'order', header: 'Orden', render: r => r.order?.order_number ?? '—' },
    {
      key: 'status',
      header: 'Estado',
      render: r => <StatusBadge value={RETURN_STATUS_LABEL[r.status]} />,
    },
    { key: 'returned_total', header: 'Devuelto', render: r => formatARS(r.returned_total), align: 'right' },
  ]

  return (
    <div className="flex flex-col h-full">
      <TopBar breadcrumbs={[{ label: 'Compras', href: '/compras' }, { label: 'Devoluciones' }]} />
      <ComprasSubNav />
      <DocumentStatusNav
        tabs={STATUS_TABS}
        active={status}
        counts={statusCounts}
        onChange={next => { setStatus(next); setPage(1) }}
        ariaLabel="Filtrar devoluciones de compra por estado"
      />
      <PageBody>
        {listError && (
          <div className="mb-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
            {listError}
          </div>
        )}
        <DataTable<ReturnRow>
          columns={columns}
          data={rows}
          keyExtractor={r => r.id}
          onRowClick={r => router.push(`/compras/devoluciones/${r.id}`)}
          emptyMessage="No hay devoluciones registradas."
          footer={
            total > 0 ? (
              <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            ) : undefined
          }
        />
      </PageBody>
    </div>
  )
}
