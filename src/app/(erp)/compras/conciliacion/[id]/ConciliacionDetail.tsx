'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, EmptyState, type Column } from '@/components/erp'
import { Badge, StatusBadge } from '@/components/primitives/Badge'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { ComprasSubNav } from '../../ComprasSubNav'
import { ReconciliationChip } from '../ConciliacionClient'
import { PURCHASE_ORDER_STATUS_LABEL } from '../../types'
import type { PurchaseOrderStatus } from '../../types'
import { fetchJson, getApiErrorMessage, isApiRequestError } from '@/lib/fetch-json'

type ReconciliationItemLine = {
  key: string
  description: string
  ordered_qty: string
  ordered_unit_price: string | null
  received_qty: string
  invoiced_qty: string
  invoiced_unit_price: string | null
  qty_mismatch: boolean
  price_mismatch: boolean
  is_extra: boolean
}

type ReconciliationDetail = {
  order: {
    id: string
    order_number: string
    status: PurchaseOrderStatus
    created_at: string
    expected_date: string | null
    total: string
    contact: { id: string; legal_name: string; trade_name: string | null } | null
  }
  items: ReconciliationItemLine[]
  summary: {
    ordered_qty: string
    received_qty: string
    invoiced_qty: string
    ordered_total: string
    invoiced_total: string
    qty_mismatch: boolean
    price_mismatch: boolean
    has_differences: boolean
  }
  receipts: Array<{ id: string; receipt_number: string; status: string; receipt_date: string | null }>
  invoices: Array<{ id: string; invoice_number: string; supplier_invoice_number: string | null; status: string; total: string }>
}

const ITEM_COLUMNS: Column<ReconciliationItemLine>[] = [
  {
    key: 'description',
    header: 'Ítem',
    render: row => (
      <div className="min-w-0">
        <span className="font-medium text-fg">{row.description}</span>
        {row.is_extra ? (
          <p className="text-[12px] text-warning">Línea extra (sin OC)</p>
        ) : null}
      </div>
    ),
  },
  {
    key: 'ordered_qty',
    header: 'Pedida',
    align: 'right',
    render: row => <span className="tabular-nums text-fg-muted">{row.ordered_qty}</span>,
  },
  {
    key: 'received_qty',
    header: 'Recibida',
    align: 'right',
    render: row => (
      <span className={`tabular-nums ${row.qty_mismatch ? 'font-medium text-danger' : 'text-fg-muted'}`}>
        {row.received_qty}
      </span>
    ),
  },
  {
    key: 'invoiced_qty',
    header: 'Facturada',
    align: 'right',
    render: row => (
      <span className={`tabular-nums ${row.qty_mismatch ? 'font-medium text-danger' : 'text-fg-muted'}`}>
        {row.invoiced_qty}
      </span>
    ),
  },
  {
    key: 'ordered_unit_price',
    header: 'Precio OC',
    align: 'right',
    render: row => (
      <span className="tabular-nums text-fg-muted">
        {row.ordered_unit_price ? formatARS(row.ordered_unit_price) : '—'}
      </span>
    ),
  },
  {
    key: 'invoiced_unit_price',
    header: 'Precio fact.',
    align: 'right',
    render: row => (
      <span className={`tabular-nums ${row.price_mismatch ? 'font-medium text-danger' : 'text-fg-muted'}`}>
        {row.invoiced_unit_price ? formatARS(row.invoiced_unit_price) : '—'}
      </span>
    ),
  },
  {
    key: 'flags',
    header: 'Estado',
    render: row => {
      if (row.qty_mismatch && row.price_mismatch) {
        return <Badge status="error" dot>Cant. y precio</Badge>
      }
      if (row.qty_mismatch) return <Badge status="error" dot>Cantidad</Badge>
      if (row.price_mismatch) return <Badge status="error" dot>Precio</Badge>
      return <Badge status="success" dot>OK</Badge>
    },
  },
]

interface ConciliacionDetailProps {
  id: string
}

export function ConciliacionDetail({ id }: ConciliacionDetailProps) {
  const [detail, setDetail] = useState<ReconciliationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const d = await fetchJson<ReconciliationDetail>(`/api/v1/purchases/reconciliation/${id}`)
        if (!mounted) return
        setDetail(d)
        setNotFound(false)
        setError(null)
      } catch (e) {
        if (!mounted) return
        if (isApiRequestError(e) && e.status === 404) {
          setNotFound(true)
        } else {
          setError(getApiErrorMessage(e))
        }
        setDetail(null)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [id])

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <TopBar breadcrumbs={[{ label: 'Conciliación', href: '/compras/conciliacion' }, { label: '…' }]} />
        <ComprasSubNav />
        <div className="flex flex-1 items-center justify-center">
          <span className="text-sm text-fg-subtle">Cargando…</span>
        </div>
      </div>
    )
  }

  if (notFound || !detail) {
    return (
      <div className="flex h-full flex-col">
        <TopBar breadcrumbs={[{ label: 'Conciliación', href: '/compras/conciliacion' }, { label: 'No encontrada' }]} />
        <ComprasSubNav />
        {error ? <p className="p-5 text-sm text-danger">{error}</p> : null}
        <EmptyState title="Orden no encontrada" description="La orden de compra no existe o no tenés acceso." />
      </div>
    )
  }

  const { order, items, summary, receipts, invoices } = detail
  const supplierName = order.contact?.trade_name ?? order.contact?.legal_name ?? '—'

  return (
    <div className="flex h-full flex-col">
      <TopBar
        breadcrumbs={[
          { label: 'Conciliación', href: '/compras/conciliacion' },
          { label: order.order_number },
        ]}
      />
      <ComprasSubNav />

      <PageBody>
        <div className="mb-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded border border-border bg-surface p-4">
            <p className="text-[12px] uppercase tracking-wide text-fg-muted">Proveedor</p>
            <p className="mt-1 font-medium text-fg">{supplierName}</p>
            <p className="mt-2 text-[12px] text-fg-muted">
              OC{' '}
              <Link href={`/compras/ordenes/${order.id}`} className="font-mono text-brand-600 hover:underline">
                {order.order_number}
              </Link>
            </p>
          </div>
          <div className="rounded border border-border bg-surface p-4">
            <p className="text-[12px] uppercase tracking-wide text-fg-muted">Estado OC</p>
            <div className="mt-2">
              <StatusBadge value={PURCHASE_ORDER_STATUS_LABEL[order.status] ?? order.status} />
            </div>
          </div>
          <div className="rounded border border-border bg-surface p-4">
            <p className="text-[12px] uppercase tracking-wide text-fg-muted">Conciliación</p>
            <div className="mt-2">
              <ReconciliationChip hasDifferences={summary.has_differences} />
            </div>
          </div>
          <div className="rounded border border-border bg-surface p-4">
            <p className="text-[12px] uppercase tracking-wide text-fg-muted">Totales</p>
            <p className="mt-1 text-[13px] text-fg-muted">
              OC {formatARS(summary.ordered_total)} · Facturado {formatARS(summary.invoiced_total)}
            </p>
            <p className="mt-1 text-[12px] text-fg-muted">
              Cant. {summary.ordered_qty} / {summary.received_qty} / {summary.invoiced_qty}
            </p>
          </div>
        </div>

        <div className="mb-5 grid gap-4 md:grid-cols-2">
          <div className="rounded border border-border bg-surface p-4">
            <p className="mb-2 text-[13px] font-semibold text-fg">Recepciones ({receipts.length})</p>
            {receipts.length === 0 ? (
              <p className="text-[13px] text-fg-muted">Sin recepciones confirmadas.</p>
            ) : (
              <ul className="space-y-1">
                {receipts.map(r => (
                  <li key={r.id}>
                    <Link href={`/compras/recepciones/${r.id}`} className="text-[13px] text-brand-600 hover:underline">
                      {r.receipt_number}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded border border-border bg-surface p-4">
            <p className="mb-2 text-[13px] font-semibold text-fg">Facturas ({invoices.length})</p>
            {invoices.length === 0 ? (
              <p className="text-[13px] text-fg-muted">Sin facturas de proveedor.</p>
            ) : (
              <ul className="space-y-1">
                {invoices.map(inv => (
                  <li key={inv.id} className="flex items-center justify-between gap-2 text-[13px]">
                    <Link href={`/compras/facturas/${inv.id}`} className="text-brand-600 hover:underline">
                      {inv.invoice_number}
                      {inv.supplier_invoice_number ? ` (${inv.supplier_invoice_number})` : ''}
                    </Link>
                    <span className="tabular-nums text-fg-muted">{formatARS(inv.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DataTable
          columns={ITEM_COLUMNS}
          data={items}
          keyExtractor={row => row.key}
          emptyMessage="No hay ítems para conciliar."
        />
      </PageBody>
    </div>
  )
}
