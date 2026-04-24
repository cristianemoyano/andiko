'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/primitives/Button'
import { StatusBadge } from '@/components/primitives/Badge'
import { TotalsFooter } from '@/components/erp/TotalsFooter'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { EmptyState } from '@/components/erp/EmptyState'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { ComprasSubNav } from '../../ComprasSubNav'
import type { PurchaseOrder } from '../../types'
import { PURCHASE_ORDER_STATUS_LABEL, PAYMENT_CONDITION_LABEL } from '../../types'

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
        const r = await fetch(`/api/v1/purchases/orders/${id}`)
        if (!mounted) return
        if (r.status === 404) { setNotFound(true); return }
        const d = await r.json() as PurchaseOrder
        if (mounted) { setOrder(d); setNotFound(false) }
      } catch {
        // network error — leave current state
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [id, refresh])

  async function doAction(endpoint: string, method = 'POST') {
    setActionError(null)
    const res = await fetch(`/api/v1/purchases/orders/${id}${endpoint}`, { method })
    if (!res.ok) {
      try {
        const d = await res.json() as { error?: string }
        setActionError(d.error ?? 'Ocurrió un error')
      } catch {
        setActionError('Ocurrió un error inesperado')
      }
      return false
    }
    setRefresh(r => r + 1)
    return true
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
          <span className="text-zinc-400 text-sm">Cargando…</span>
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

  const isCancelled = order.status === 'cancelled'
  const isReceived  = order.status === 'received'
  const isDraft     = order.status === 'draft'
  const isSent      = order.status === 'sent'

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
          <div className="flex gap-2">
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
            {(isSent || order.status === 'partially_received') && (
              <Button
                size="sm"
                onClick={() => router.push(`/compras/recepciones/nueva?order_id=${order.id}`)}
              >
                Registrar recepción
              </Button>
            )}
          </div>
        }
      />
      <ComprasSubNav />

      <div className="flex-1 p-5 overflow-auto">
        <div className="max-w-4xl mx-auto flex flex-col gap-5">

          {actionError && (
            <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-sm text-sm text-red-700">
              {actionError}
            </div>
          )}

          {/* Header card */}
          <div className="bg-white border border-zinc-200 rounded-sm px-5 py-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wide mb-1">Orden de compra</p>
              <h1 className="text-[20px] font-bold text-zinc-900 tracking-tight">{order.order_number}</h1>
              <p className="text-[13px] text-zinc-500 mt-0.5">
                {order.contact?.legal_name ?? 'Sin proveedor'} · {order.branch?.name ?? 'Sin sucursal'}
              </p>
            </div>
            <StatusBadge value={PURCHASE_ORDER_STATUS_LABEL[order.status]} />
          </div>

          {/* Metadata card */}
          <div className="bg-white border border-zinc-200 rounded-sm p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px]">
              <div>
                <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Condición de pago</p>
                <p className="text-zinc-800">{PAYMENT_CONDITION_LABEL[order.payment_condition] ?? order.payment_condition}</p>
              </div>
              <div>
                <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Fecha esperada</p>
                <p className="text-zinc-800">
                  {order.expected_date ? new Date(order.expected_date).toLocaleDateString('es-AR') : '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Moneda</p>
                <p className="text-zinc-800">{order.currency}</p>
              </div>
              <div>
                <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Creada</p>
                <p className="text-zinc-800">{new Date(order.created_at).toLocaleDateString('es-AR')}</p>
              </div>
            </div>
          </div>

          {/* Items card */}
          <div className="bg-white border border-zinc-200 rounded-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Descripción</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Cant.</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Recibido</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">P. Unitario</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">IVA</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(order.items ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-400 text-sm">Sin ítems</td>
                  </tr>
                ) : (
                  (order.items ?? []).map(item => (
                    <tr key={item.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-2.5 text-zinc-900">{item.description}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700">{parseFloat(item.quantity).toLocaleString('es-AR')}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">{parseFloat(item.received_qty ?? '0').toLocaleString('es-AR')}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatARS(item.unit_price)}</td>
                      <td className="px-4 py-2.5 text-right text-zinc-500">{item.iva_rate}%</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatARS(item.total)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div className="border-t border-zinc-100">
              <TotalsFooter
                subtotal={String(subtotal.toFixed(2))}
                taxAmount={String(taxAmt.toFixed(2))}
                total={String(totalAmt.toFixed(2))}
              />
            </div>
          </div>

          {order.notes && (
            <div className="bg-white border border-zinc-200 rounded-sm px-5 py-4 text-[13px] text-zinc-700">
              <p className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wide mb-1.5">Notas</p>
              {order.notes}
            </div>
          )}

        </div>
      </div>

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
