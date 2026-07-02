'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import {
  DataTable,
  TablePagination,
  SalesOrderChannelBadge,
  SalesOrderNumberCell,
  SalesOrderDateCell,
  SalesOrderStatusCell,
  TableColumnPicker,
  type Column,
} from '@/components/erp'
import { Button } from '@/components/primitives/Button'
import { formatARS } from '@/components/primitives/CurrencyInput'
import type { Order } from '../types'
import { PAYMENT_CONDITION_LABEL } from '../types'
import { VentasSubNav } from '../VentasSubNav'
import { PedidosStatusNav, type PedidosStatusTab } from './PedidosStatusNav'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { SALES_ORDER_CHANNEL_LABEL } from '@/modules/sales/sales-order-channel.utils'
import type { SalesOrderSource } from '@/modules/sales/sales-order.model'
import {
  WOO_ORDER_STATUS_LABELS,
  WOO_ORDER_STATUS_SLUGS,
  type WooOrderStatusSlug,
} from '@/modules/integrations/woocommerce/woo-order-status.utils'
import {
  filterColumnsByVisibility,
  usePersistedTableColumns,
  type TableColumnOption,
} from '@/lib/use-persisted-table-columns'

const PAGE_SIZE = 20
const PEDIDOS_COLUMNS_STORAGE_KEY = 'andiko.ventas.pedidos.columns.v2'

const EMPTY_STATUS_COUNTS: Record<PedidosStatusTab, number> = {
  '': 0,
  draft: 0,
  confirmed: 0,
  in_progress: 0,
  delivered: 0,
  returns: 0,
  cancelled: 0,
}

type SourceFilter = SalesOrderSource | ''
type WooStatusFilter = WooOrderStatusSlug | ''

const SOURCE_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: '',             label: 'Todos los orígenes' },
  { value: 'erp',          label: SALES_ORDER_CHANNEL_LABEL.erp },
  { value: 'pos',          label: SALES_ORDER_CHANNEL_LABEL.pos },
  { value: 'woocommerce',  label: SALES_ORDER_CHANNEL_LABEL.woocommerce },
]

/** Default: N° · Cliente · Sucursal · Fecha · Estado · Total · Origen */
const PEDIDOS_COLUMN_OPTIONS: TableColumnOption[] = [
  { key: 'order_number',      label: 'N°' },
  { key: 'contact',           label: 'Cliente' },
  { key: 'branch',            label: 'Sucursal' },
  { key: 'created_at',        label: 'Fecha' },
  { key: 'status',            label: 'Estado' },
  { key: 'total',             label: 'Total' },
  { key: 'channel',           label: 'Origen' },
  { key: 'payment_condition', label: 'Condición', defaultVisible: false },
  { key: 'promised_date',     label: 'Fecha prometida', defaultVisible: false },
  { key: 'salesperson',       label: 'Vendedor', defaultVisible: false },
]

function statusTabToQuery(tab: PedidosStatusTab): { status?: string; statuses?: string } {
  if (!tab) return {}
  if (tab === 'returns') return { statuses: 'partial_returned,returned' }
  return { status: tab }
}

function buildListParams(input: {
  page: number
  search: string
  statusTab: PedidosStatusTab
  wooStatus: WooStatusFilter
  source: SourceFilter
  branchId: string
  fromDate: string
  toDate: string
}): URLSearchParams {
  const statusQuery = statusTabToQuery(input.statusTab)
  return new URLSearchParams({
    page:  String(input.page),
    limit: String(PAGE_SIZE),
    ...(input.search ? { search: input.search } : {}),
    ...statusQuery,
    ...(input.wooStatus ? { woo_status: input.wooStatus } : {}),
    ...(input.source ? { source: input.source } : {}),
    ...(input.branchId ? { branch_id: input.branchId } : {}),
    ...(input.fromDate ? { from: input.fromDate } : {}),
    ...(input.toDate ? { to: input.toDate } : {}),
  })
}

function buildPedidosColumns(): Column<Order>[] {
  return [
    {
      key: 'order_number',
      header: 'N°',
      render: row => (
        <SalesOrderNumberCell
          erpNumber={row.order_number}
          wooOrderId={row.woo_channel?.woo_order_id}
        />
      ),
    },
    {
      key: 'contact',
      header: 'Cliente',
      sortable: true,
      render: row =>
        row.contact ? (
          <span className="font-medium text-fg">{row.contact.legal_name}</span>
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
    {
      key: 'branch',
      header: 'Sucursal',
      render: row =>
        row.branch ? (
          <span className="text-[12px] text-fg-muted">
            {String(row.branch.branch_code).padStart(2, '0')} — {row.branch.name}
          </span>
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
    {
      key: 'created_at',
      header: 'Fecha',
      sortable: true,
      render: row => (
        <SalesOrderDateCell
          erpCreatedAt={row.created_at}
          wooOrderCreatedAt={row.woo_channel?.woo_order_created_at}
        />
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: row => (
        <SalesOrderStatusCell
          erpStatus={row.status}
          wooStatusLabel={row.woo_channel?.woo_status_label}
        />
      ),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: row => (
        <span className="tabular-nums font-medium">{formatARS(row.total)}</span>
      ),
    },
    {
      key: 'channel',
      header: 'Origen',
      render: row => <SalesOrderChannelBadge source={row.source} />,
    },
    {
      key: 'payment_condition',
      header: 'Condición',
      render: row => PAYMENT_CONDITION_LABEL[row.payment_condition],
    },
    {
      key: 'promised_date',
      header: 'Fecha prometida',
      render: row =>
        row.promised_date
          ? new Date(row.promised_date).toLocaleDateString('es-AR')
          : <span className="text-fg-subtle">—</span>,
    },
    {
      key: 'salesperson',
      header: 'Vendedor',
      render: row => row.salesperson
        ? <span className="text-[12px] text-fg-muted">{row.salesperson.name}</span>
        : <span className="text-fg-subtle">—</span>,
    },
  ]
}

const ALL_PEDIDOS_COLUMNS = buildPedidosColumns()

export function PedidosClient() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal]   = useState(0)
  const [statusCounts, setStatusCounts] = useState<Record<PedidosStatusTab, number>>(EMPTY_STATUS_COUNTS)
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [statusTab, setStatusTab] = useState<PedidosStatusTab>('')
  const [wooStatusFilter, setWooStatusFilter] = useState<WooStatusFilter>('')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('')
  const [branchFilter, setBranchFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [branches, setBranches] = useState<Array<{ id: string; name: string; branch_code: number }>>([])
  const [listError, setListError] = useState<string | null>(null)

  const { visibleKeys, toggleColumn, resetColumns } = usePersistedTableColumns(
    PEDIDOS_COLUMNS_STORAGE_KEY,
    PEDIDOS_COLUMN_OPTIONS,
  )

  const columns = useMemo(
    () => filterColumnsByVisibility(ALL_PEDIDOS_COLUMNS, visibleKeys),
    [visibleKeys],
  )

  const sharedFilters = useMemo(() => ({
    search,
    wooStatus: wooStatusFilter,
    source: sourceFilter,
    branchId: branchFilter,
    fromDate,
    toDate,
  }), [search, wooStatusFilter, sourceFilter, branchFilter, fromDate, toDate])

  useEffect(() => {
    let mounted = true
    void (async () => {
      try {
        const res = await fetchJson<{ data: Array<{ id: string; name: string; branch_code: number }> }>(
          '/api/v1/branches?limit=100',
        )
        if (!mounted) return
        setBranches(res.data ?? [])
      } catch {
        if (!mounted) return
        setBranches([])
      }
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let mounted = true
    const params = buildListParams({ page, statusTab, ...sharedFilters })
    ;(async () => {
      setListError(null)
      try {
        const data = await fetchJson<{ data: Order[]; total: number }>(`/api/v1/sales/orders?${params}`)
        if (!mounted) return
        const rows = Array.isArray(data?.data) ? data.data : []
        const nextTotal = typeof data?.total === 'number' ? data.total : 0
        setOrders(rows)
        setTotal(nextTotal)
        const pages = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE))
        setPage(p => (p > pages ? pages : p))
      } catch (e) {
        if (!mounted) return
        setListError(getApiErrorMessage(e))
        setOrders([])
        setTotal(0)
      }
    })()
    return () => { mounted = false }
  }, [page, statusTab, sharedFilters])

  useEffect(() => {
    let mounted = true
    const params = buildListParams({ page: 1, statusTab: '', ...sharedFilters })
    void (async () => {
      try {
        const res = await fetchJson<{ data: Record<PedidosStatusTab, number> }>(
          `/api/v1/sales/orders/status-counts?${params}`,
        )
        if (!mounted) return
        setStatusCounts({ ...EMPTY_STATUS_COUNTS, ...(res.data ?? {}) })
      } catch {
        if (!mounted) return
        setStatusCounts(EMPTY_STATUS_COUNTS)
      }
    })()
    return () => { mounted = false }
  }, [sharedFilters])

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Ventas', href: '/ventas/presupuestos' }, { label: 'Pedidos' }]}
        actions={
          <Button size="sm" onClick={() => router.push('/ventas/pedidos/nuevo')}>
            + Nuevo pedido
          </Button>
        }
      />
      <VentasSubNav />
      <PedidosStatusNav
        active={statusTab}
        counts={statusCounts}
        onChange={tab => { setStatusTab(tab); setPage(1) }}
      />

      <PageBody>
        {listError && (
          <div className="mb-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
            {listError}
          </div>
        )}
        <DataTable
          columns={columns}
          data={orders}
          keyExtractor={r => r.id}
          stickyFirstColumn
          onRowClick={row => router.push(`/ventas/pedidos/${row.id}`)}
          emptyMessage="No hay pedidos. Creá el primero."
          toolbar={
            <>
              <div className="relative flex items-center w-full sm:w-auto">
                <svg className="absolute left-2 text-fg-subtle pointer-events-none" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/>
                </svg>
                <input
                  className="pl-7 pr-3 h-[30px] text-[13px] border border-border-strong rounded-sm w-full sm:w-52 bg-surface focus:outline-none focus:border-ring"
                  placeholder="Buscar por cliente o número…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                />
              </div>
              <select
                className="h-[30px] text-[13px] border border-border-strong rounded-sm px-2 bg-surface focus:outline-none focus:border-ring text-fg-muted"
                value={wooStatusFilter}
                onChange={e => { setWooStatusFilter(e.target.value as WooStatusFilter); setPage(1) }}
              >
                <option value="">Estado WooCommerce</option>
                {WOO_ORDER_STATUS_SLUGS.map(slug => (
                  <option key={slug} value={slug}>
                    {WOO_ORDER_STATUS_LABELS[slug]}
                  </option>
                ))}
              </select>
              <select
                className="h-[30px] text-[13px] border border-border-strong rounded-sm px-2 bg-surface focus:outline-none focus:border-ring text-fg-muted"
                value={sourceFilter}
                onChange={e => { setSourceFilter(e.target.value as SourceFilter); setPage(1) }}
              >
                {SOURCE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {branches.length > 1 ? (
                <select
                  className="h-[30px] text-[13px] border border-border-strong rounded-sm px-2 bg-surface focus:outline-none focus:border-ring text-fg-muted max-w-[180px]"
                  value={branchFilter}
                  onChange={e => { setBranchFilter(e.target.value); setPage(1) }}
                >
                  <option value="">Todas las sucursales</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>
                      {String(b.branch_code).padStart(2, '0')} — {b.name}
                    </option>
                  ))}
                </select>
              ) : null}
              <label className="flex items-center gap-1 text-[12px] text-fg-muted whitespace-nowrap">
                Desde
                <input
                  type="date"
                  className="h-[30px] rounded-sm border border-border-strong bg-surface px-2 text-[13px] text-fg-muted focus:border-ring focus:outline-none"
                  value={fromDate}
                  onChange={e => { setFromDate(e.target.value); setPage(1) }}
                />
              </label>
              <label className="flex items-center gap-1 text-[12px] text-fg-muted whitespace-nowrap">
                Hasta
                <input
                  type="date"
                  className="h-[30px] rounded-sm border border-border-strong bg-surface px-2 text-[13px] text-fg-muted focus:border-ring focus:outline-none"
                  value={toDate}
                  onChange={e => { setToDate(e.target.value); setPage(1) }}
                />
              </label>
              <TableColumnPicker
                options={PEDIDOS_COLUMN_OPTIONS}
                visibleKeys={visibleKeys}
                onToggle={toggleColumn}
                onReset={resetColumns}
              />
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
