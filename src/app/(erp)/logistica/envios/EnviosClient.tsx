'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, TablePagination, ShipmentStatusBadge, type Column } from '@/components/erp'
import { formatARS } from '@/components/primitives/CurrencyInput'
import {
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_LABEL,
  FULFILLMENT_KINDS,
  FULFILLMENT_KIND_LABEL,
  type ShipmentStatus,
  type FulfillmentKind,
} from '@/modules/logistics/logistics.constants'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { LogisticaSubNav } from '../LogisticaSubNav'
import { formatShipmentDestination, type ShipmentListRow } from '../types'

const PAGE_SIZE = 20

const COLUMNS: Column<ShipmentListRow>[] = [
  {
    key: 'shipment_number',
    header: 'N°',
    render: row => <span className="font-medium text-fg">{row.shipment_number}</span>,
  },
  {
    key: 'order',
    header: 'Pedido',
    render: row => row.salesOrder
      ? <span className="text-[12px] text-fg-muted">{row.salesOrder.order_number}</span>
      : <span className="text-fg-subtle">—</span>,
  },
  {
    key: 'destination',
    header: 'Destino',
    render: row => <span className="text-[12px] text-fg-muted">{formatShipmentDestination(row)}</span>,
  },
  {
    key: 'kind',
    header: 'Transporte',
    render: row => (
      <span className="text-[12px] text-fg-muted">
        {row.carrierAccount?.name ?? FULFILLMENT_KIND_LABEL[row.provider_kind]}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Estado',
    render: row => <ShipmentStatusBadge status={row.status} />,
  },
  {
    key: 'tracking',
    header: 'Seguimiento',
    render: row => row.tracking_number
      ? (
        row.tracking_url ? (
          <a
            href={row.tracking_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-[12px] text-brand-accent hover:underline"
          >
            {row.tracking_number}
          </a>
        ) : (
          <span className="text-[12px] tabular-nums text-fg-muted">{row.tracking_number}</span>
        )
      )
      : row.driver
        ? <span className="text-[12px] text-fg-muted">{row.driver.name}</span>
        : <span className="text-fg-subtle">—</span>,
  },
  {
    key: 'shipping_cost',
    header: 'Costo',
    align: 'right',
    render: row => parseFloat(row.shipping_cost) > 0
      ? <span className="tabular-nums">{formatARS(row.shipping_cost)}</span>
      : <span className="text-fg-subtle">—</span>,
  },
  {
    key: 'created_at',
    header: 'Fecha',
    render: row => (
      <span className="text-[12px] text-fg-muted">
        {new Date(row.created_at).toLocaleDateString('es-AR')}
      </span>
    ),
  },
]

export function EnviosClient() {
  const router = useRouter()
  const [rows, setRows]     = useState<ShipmentListRow[]>([])
  const [total, setTotal]   = useState(0)
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | ''>('')
  const [kindFilter, setKindFilter] = useState<FulfillmentKind | ''>('')
  const [listError, setListError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const params = new URLSearchParams({
      page:  String(page),
      limit: String(PAGE_SIZE),
      ...(search ? { search } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(kindFilter ? { provider_kind: kindFilter } : {}),
    })
    ;(async () => {
      setListError(null)
      try {
        const data = await fetchJson<{ data: ShipmentListRow[]; total: number }>(`/api/v1/logistics/shipments?${params}`)
        if (!mounted) return
        const nextTotal = typeof data?.total === 'number' ? data.total : 0
        setRows(Array.isArray(data?.data) ? data.data : [])
        setTotal(nextTotal)
        const pages = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE))
        setPage(p => (p > pages ? pages : p))
      } catch (e) {
        if (!mounted) return
        setListError(getApiErrorMessage(e))
        setRows([])
        setTotal(0)
      }
    })()
    return () => { mounted = false }
  }, [page, search, statusFilter, kindFilter])

  return (
    <div className="flex flex-col h-full">
      <TopBar breadcrumbs={[{ label: 'Logística', href: '/logistica/envios' }, { label: 'Envíos' }]} />
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
          keyExtractor={r => r.id}
          stickyFirstColumn
          onRowClick={row => router.push(`/logistica/envios/${row.id}`)}
          emptyMessage="No hay envíos. Se generan desde el detalle de un pedido de ventas."
          toolbar={
            <>
              <div className="relative flex items-center w-full sm:w-auto">
                <svg className="absolute left-2 text-fg-subtle pointer-events-none" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/>
                </svg>
                <input
                  className="pl-7 pr-3 h-[30px] text-[13px] border border-border-strong rounded-sm w-full sm:w-52 bg-surface focus:outline-none focus:border-ring"
                  placeholder="Buscar por número o destino…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                />
              </div>
              <select
                className="h-[30px] text-[13px] border border-border-strong rounded-sm px-2 bg-surface focus:outline-none focus:border-ring text-fg-muted"
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value as ShipmentStatus | ''); setPage(1) }}
              >
                <option value="">Todos los estados</option>
                {SHIPMENT_STATUSES.map(s => (
                  <option key={s} value={s}>{SHIPMENT_STATUS_LABEL[s]}</option>
                ))}
              </select>
              <select
                className="h-[30px] text-[13px] border border-border-strong rounded-sm px-2 bg-surface focus:outline-none focus:border-ring text-fg-muted"
                value={kindFilter}
                onChange={e => { setKindFilter(e.target.value as FulfillmentKind | ''); setPage(1) }}
              >
                <option value="">Todos los transportes</option>
                {FULFILLMENT_KINDS.map(k => (
                  <option key={k} value={k}>{FULFILLMENT_KIND_LABEL[k]}</option>
                ))}
              </select>
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
    </div>
  )
}
