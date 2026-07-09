'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import {
  DELIVERY_RUN_STATUSES,
  DELIVERY_RUN_STATUS_LABEL,
  FULFILLMENT_KIND_LABEL,
  type DeliveryRunStatus,
} from '@/modules/logistics/logistics.constants'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { LogisticaSubNav } from '../LogisticaSubNav'
import type { DeliveryRunListRow } from '../types'

const PAGE_SIZE = 20

function formatDateOnly(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : '—'
}

function RunStatusBadge({ status }: { status: DeliveryRunStatus }) {
  const tone = {
    draft:       'bg-surface-muted text-fg-muted border-border',
    planned:     'bg-blue-50 text-blue-700 border-blue-200',
    dispatched:  'bg-amber-50 text-amber-700 border-amber-200',
    in_progress: 'bg-brand-accent-bg text-brand-accent border-brand-200',
    completed:   'bg-green-50 text-green-700 border-green-200',
    cancelled:   'bg-danger-bg text-danger border-danger',
  }[status]
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      {DELIVERY_RUN_STATUS_LABEL[status]}
    </span>
  )
}

const COLUMNS: Column<DeliveryRunListRow>[] = [
  {
    key: 'run_number',
    header: 'N°',
    render: row => <span className="font-medium text-fg">{row.run_number}</span>,
  },
  {
    key: 'planned_date',
    header: 'Fecha',
    render: row => (
      <span className="text-[12px] text-fg-muted">
        {formatDateOnly(row.planned_date)}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Estado',
    render: row => <RunStatusBadge status={row.status} />,
  },
  {
    key: 'driver',
    header: 'Repartidor',
    render: row => row.driver
      ? <span className="text-[12px] text-fg-muted">{row.driver.name}</span>
      : <span className="text-fg-subtle">—</span>,
  },
  {
    key: 'vehicle',
    header: 'Vehículo',
    render: row => row.vehicle_ref
      ? <span className="text-[12px] text-fg-muted">{row.vehicle_ref}</span>
      : <span className="text-fg-subtle">—</span>,
  },
  {
    key: 'provider',
    header: 'Transporte',
    render: row => (
      <span className="text-[12px] text-fg-muted">
        {row.carrierAccount?.name ?? FULFILLMENT_KIND_LABEL[row.provider_kind]}
      </span>
    ),
  },
  {
    key: 'shipments',
    header: 'Envíos',
    align: 'right',
    render: row => <span className="tabular-nums">{row.shipment_count}</span>,
  },
]

export function SalidasClient() {
  const router = useRouter()
  const [rows, setRows] = useState<DeliveryRunListRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<DeliveryRunStatus | ''>('')
  const [listError, setListError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const params = new URLSearchParams({
      page:  String(page),
      limit: String(PAGE_SIZE),
      ...(search ? { search } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    })
    void (async () => {
      setListError(null)
      try {
        const data = await fetchJson<{ data: DeliveryRunListRow[]; total: number }>(`/api/v1/logistics/delivery-runs?${params}`)
        if (!mounted) return
        const nextTotal = typeof data.total === 'number' ? data.total : 0
        setRows(Array.isArray(data.data) ? data.data : [])
        setTotal(nextTotal)
        const pages = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE))
        setPage(p => (p > pages ? pages : p))
      } catch (err) {
        if (!mounted) return
        setListError(getApiErrorMessage(err))
        setRows([])
        setTotal(0)
      }
    })()
    return () => { mounted = false }
  }, [page, search, statusFilter])

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Logística', href: '/logistica/salidas' }, { label: 'Salidas' }]}
        actions={
          <Button asChild size="sm">
            <Link href="/logistica/salidas/nueva">+ Nueva salida</Link>
          </Button>
        }
      />
      <LogisticaSubNav />

      <PageBody>
        {listError && (
          <div className="mb-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
            {listError}
          </div>
        )}
        <DataTable
          columns={COLUMNS}
          data={rows}
          keyExtractor={row => row.id}
          stickyFirstColumn
          onRowClick={row => router.push(`/logistica/salidas/${row.id}`)}
          emptyMessage="No hay salidas de reparto. Armá una salida agrupando envíos pendientes."
          toolbar={
            <>
              <Input
                className="h-[30px] w-full sm:w-56"
                placeholder="Buscar salida…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
              />
              <Select
                value={statusFilter}
                onChange={value => { setStatusFilter(value as DeliveryRunStatus | ''); setPage(1) }}
                options={[
                  { value: '', label: 'Todos los estados' },
                  ...DELIVERY_RUN_STATUSES.map(status => ({ value: status, label: DELIVERY_RUN_STATUS_LABEL[status] })),
                ]}
                className="h-[30px] w-full sm:w-48"
              />
              <span className="flex-1" />
              <span className="text-[12px] text-fg-muted">{total} salida{total !== 1 ? 's' : ''}</span>
            </>
          }
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
