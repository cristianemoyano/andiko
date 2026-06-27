'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, TablePagination, type Column } from '@/components/erp'
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

export function DevolucionesComprasClient() {
  const router = useRouter()
  const [rows, setRows] = useState<ReturnRow[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [listError, setListError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    void (async () => {
      setListError(null)
      try {
        const data = await fetchJson<{ data: ReturnRow[]; total: number }>(
          `/api/v1/purchases/returns?page=${page}&limit=${PAGE_SIZE}`,
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
  }, [page])

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
        />
        <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </PageBody>
    </div>
  )
}
