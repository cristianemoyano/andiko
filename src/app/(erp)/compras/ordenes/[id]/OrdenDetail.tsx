'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { Button } from '@/components/primitives/Button'
import { StatusBadge } from '@/components/primitives/Badge'
import { TotalsFooter } from '@/components/erp/TotalsFooter'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { EmptyState } from '@/components/erp/EmptyState'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { ComprasSubNav } from '../../ComprasSubNav'
import type { PurchaseOrder } from '../../types'
import { PURCHASE_ORDER_STATUS_LABEL, PURCHASE_RECEIPT_STATUS_LABEL, SUPPLIER_INVOICE_STATUS_LABEL, PAYMENT_CONDITION_LABEL } from '../../types'
import { fetchJson, getApiErrorMessage, isApiRequestError } from '@/lib/fetch-json'

interface OrdenDetailProps {
  id: string
}

export function OrdenDetail({ id }: OrdenDetailProps) {
  const router = useRouter()
  const [order, setOrder]       = useState<PurchaseOrder | null>(null)
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [refresh, setRefresh]   = useState(0)

  const [confirmSend,   setConfirmSend]   = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [actionError,   setActionError]   = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const d = await fetchJson<PurchaseOrder>(`/api/v1/purchases/orders/${id}`)
        if (mounted) { setOrder(d); setNotFound(false) }
      } catch (e) {
        if (!mounted) return
        if (isApiRequestError(e) && e.status === 404) setNotFound(true)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [id, refresh])

  async function doAction(endpoint: string, method = 'POST') {
    setActionError(null)
    try {
      await fetchJson(`/api/v1/purchases/orders/${id}${endpoint}`, { method })
      setRefresh(r => r + 1)
      return true
    } catch (e) {
      setActionError(getApiErrorMessage(e))
      return false
    }
  }

  async function handleDelete() {
    const ok = await doAction('', 'DELETE')
    if (ok) router.push('/compras/ordenes')
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Órdenes de compra', href: '/compras/ordenes' }, { label: '…' }]} />
        <ComprasSubNav />
        <div className="flex-1 flex items-center justify-center">
          <span className="text-fg-subtle text-sm">Cargando…</span>
        </div>
      </div>
    )
  }

  if (notFound || !order) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Órdenes de compra', href: '/compras/ordenes' }, { label: 'No encontrada' }]} />
        <ComprasSubNav />
        <EmptyState title="Orden no encontrada" description="La orden de compra no existe o fue eliminada." />
      </div>
    )
  }

  const isCancelled        = order.status === 'cancelled'
  const isReceived         = order.status === 'received'
  const isDraft            = order.status === 'draft'
  const isSent             = order.status === 'sent'
  const isPartiallyReceived = order.status === 'partially_received'

  const subtotal = (order.items ?? []).reduce((acc, i) => acc + parseFloat(i.subtotal), 0)
  const taxAmt   = (order.items ?? []).reduce((acc, i) => acc + parseFloat(i.tax_amount), 0)
  const totalAmt = (order.items ?? []).reduce((acc, i) => acc + parseFloat(i.total), 0)

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Órdenes de compra', href: '/compras/ordenes' },
          { label: order.order_number },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link href={`/compras/ordenes/${id}/print`} target="_blank" rel="noopener noreferrer">
                Imprimir
              </Link>
            </Button>
            {isDraft && (
              <>
                <Button size="sm" variant="secondary" onClick={() => setConfirmDelete(true)}>
                  Eliminar
                </Button>
                <Button size="sm" onClick={() => setConfirmSend(true)}>
                  Enviar a proveedor
                </Button>
              </>
            )}
            {(isDraft || isSent) && !isCancelled && !isReceived && (
              <Button size="sm" variant="danger" onClick={() => setConfirmCancel(true)}>
                Cancelar
              </Button>
            )}
            {(isSent || isPartiallyReceived) && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => router.push(`/compras/recepciones/nueva?order_id=${order.id}`)}
              >
                Registrar recepción
              </Button>
            )}
            {(isSent || isPartiallyReceived || isReceived) && (
              <Button
                size="sm"
                onClick={() => router.push(`/compras/facturas/nueva?order_id=${order.id}`)}
              >
                Nueva factura
              </Button>
            )}
          </div>
        }
      />
      <ComprasSubNav />

      <PageBody>
        <div className="max-w-4xl mx-auto flex flex-col gap-5">

          {actionError && (
            <div className="px-4 py-2 bg-danger-bg border border-danger rounded-sm text-sm text-danger">
              {actionError}
            </div>
          )}

          {/* Header card */}
          <div className="bg-surface border border-border rounded-sm px-5 py-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide mb-1">Orden de compra</p>
              <h1 className="text-[20px] font-bold text-fg tracking-tight">{order.order_number}</h1>
              <p className="text-[13px] text-fg-muted mt-0.5">
                {order.contact?.legal_name ?? 'Sin proveedor'} · {order.branch?.name ?? 'Sin sucursal'}
              </p>
            </div>
            <StatusBadge value={PURCHASE_ORDER_STATUS_LABEL[order.status]} />
          </div>

          {/* Metadata card */}
          <div className="bg-surface border border-border rounded-sm p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px]">
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Condición de pago</p>
                <p className="text-fg">{PAYMENT_CONDITION_LABEL[order.payment_condition] ?? order.payment_condition}</p>
              </div>
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Fecha esperada</p>
                <p className="text-fg">
                  {order.expected_date ? new Date(order.expected_date).toLocaleDateString('es-AR') : '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Moneda</p>
                <p className="text-fg">{order.currency}</p>
              </div>
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Creada</p>
                <p className="text-fg">{new Date(order.created_at).toLocaleDateString('es-AR')}</p>
              </div>
              {order.buyer && (
                <div>
                  <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Comprador</p>
                  <p className="text-fg">{order.buyer.name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Items card */}
          <div className="bg-surface border border-border rounded-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Descripción</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Cant.</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Recibido</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">P. Unitario</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">IVA</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(order.items ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-fg-subtle text-sm">Sin ítems</td>
                  </tr>
                ) : (
                  (order.items ?? []).map(item => (
                    <tr key={item.id} className="hover:bg-surface-muted/50">
                      <td className="px-4 py-2.5 text-fg">{item.description}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">{parseFloat(item.quantity).toLocaleString('es-AR')}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">{parseFloat(item.received_qty ?? '0').toLocaleString('es-AR')}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatARS(item.unit_price)}</td>
                      <td className="px-4 py-2.5 text-right text-fg-muted">{item.iva_rate}%</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatARS(item.total)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div className="border-t border-border">
              <TotalsFooter
                subtotal={String(subtotal.toFixed(2))}
                taxAmount={String(taxAmt.toFixed(2))}
                total={String(totalAmt.toFixed(2))}
              />
            </div>
          </div>

          {order.notes && (
            <div className="bg-surface border border-border rounded-sm px-5 py-4 text-[13px] text-fg-muted">
              <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide mb-1.5">Notas</p>
              {order.notes}
            </div>
          )}

          {/* Receipts traceability card */}
          <div className="bg-surface border border-border rounded-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <p className="text-[12px] font-semibold text-fg-muted uppercase tracking-wide">Recepciones</p>
              {(isSent || isPartiallyReceived) && (
                <button
                  onClick={() => router.push(`/compras/recepciones/nueva?order_id=${order.id}`)}
                  className="text-[12px] text-blue-600 hover:text-blue-700 font-medium"
                >
                  + Registrar recepción
                </button>
              )}
            </div>
            {(order.receipts ?? []).length === 0 ? (
              <p className="px-5 py-4 text-[13px] text-fg-subtle">Sin recepciones registradas.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface-muted border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Número</th>
                    <th className="text-left px-4 py-2 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Fecha</th>
                    <th className="text-left px-4 py-2 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(order.receipts ?? []).map(rec => (
                    <tr
                      key={rec.id}
                      className="hover:bg-surface-muted/50 cursor-pointer"
                      onClick={() => router.push(`/compras/recepciones/${rec.id}`)}
                    >
                      <td className="px-4 py-2.5 text-fg font-medium text-[13px]">{rec.receipt_number}</td>
                      <td className="px-4 py-2.5 text-fg-muted text-[13px]">
                        {rec.receipt_date ? new Date(rec.receipt_date).toLocaleDateString('es-AR') : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge value={PURCHASE_RECEIPT_STATUS_LABEL[rec.status]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Supplier invoices traceability card */}
          <div className="bg-surface border border-border rounded-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <p className="text-[12px] font-semibold text-fg-muted uppercase tracking-wide">Facturas de proveedor</p>
              {(isSent || isPartiallyReceived || isReceived) && (
                <button
                  onClick={() => router.push(`/compras/facturas/nueva?order_id=${order.id}`)}
                  className="text-[12px] text-blue-600 hover:text-blue-700 font-medium"
                >
                  + Nueva factura
                </button>
              )}
            </div>
            {(order.supplierInvoices ?? []).length === 0 ? (
              <p className="px-5 py-4 text-[13px] text-fg-subtle">Sin facturas vinculadas.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface-muted border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Número</th>
                    <th className="text-right px-4 py-2 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Total</th>
                    <th className="text-left px-4 py-2 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(order.supplierInvoices ?? []).map(inv => (
                    <tr
                      key={inv.id}
                      className="hover:bg-surface-muted/50 cursor-pointer"
                      onClick={() => router.push(`/compras/facturas/${inv.id}`)}
                    >
                      <td className="px-4 py-2.5 text-fg font-medium text-[13px]">{inv.invoice_number}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted text-[13px]">{formatARS(inv.total)}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge value={SUPPLIER_INVOICE_STATUS_LABEL[inv.status]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        </div>
      </PageBody>

      <ConfirmDialog
        open={confirmSend}
        onOpenChange={setConfirmSend}
        title="Enviar orden al proveedor"
        description={`¿Confirmás que querés enviar la orden ${order.order_number} al proveedor?`}
        variant="warning"
        confirmLabel="Enviar"
        onConfirm={async () => { await doAction('/send'); setConfirmSend(false) }}
      />

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancelar orden de compra"
        description={`¿Estás seguro de que querés cancelar la orden ${order.order_number}?`}
        variant="danger"
        confirmLabel="Cancelar orden"
        onConfirm={async () => { await doAction('/cancel'); setConfirmCancel(false) }}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Eliminar orden de compra"
        description={`¿Estás seguro de que querés eliminar la orden ${order.order_number}?`}
        variant="danger"
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
      />
    </div>
  )
}
