'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/primitives/Button'
import { StatusBadge } from '@/components/primitives/Badge'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { EmptyState } from '@/components/erp/EmptyState'
import { ComprasSubNav } from '../../ComprasSubNav'
import type { PurchaseReceipt } from '../../types'
import { PURCHASE_ORDER_STATUS_LABEL, PURCHASE_RECEIPT_STATUS_LABEL, SUPPLIER_INVOICE_STATUS_LABEL } from '../../types'
import { formatARS } from '@/components/primitives/CurrencyInput'

interface RecepcionDetailProps {
  id: string
}

export function RecepcionDetail({ id }: RecepcionDetailProps) {
  const router = useRouter()
  const [receipt, setReceipt]   = useState<PurchaseReceipt | null>(null)
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [refresh, setRefresh]   = useState(0)
  const [confirmConfirm, setConfirmConfirm] = useState(false)
  const [confirmDelete,  setConfirmDelete]  = useState(false)
  const [actionError,    setActionError]    = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const r = await fetch(`/api/v1/purchases/receipts/${id}`)
        if (!mounted) return
        if (r.status === 404) { setNotFound(true); return }
        const d = await r.json() as PurchaseReceipt
        if (mounted) { setReceipt(d); setNotFound(false) }
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
    const res = await fetch(`/api/v1/purchases/receipts/${id}${endpoint}`, { method })
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
    if (ok) router.push('/compras/recepciones')
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Recepciones', href: '/compras/recepciones' }, { label: '…' }]} />
        <ComprasSubNav />
        <div className="flex-1 flex items-center justify-center">
          <span className="text-zinc-400 text-sm">Cargando…</span>
        </div>
      </div>
    )
  }

  if (notFound || !receipt) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Recepciones', href: '/compras/recepciones' }, { label: 'No encontrada' }]} />
        <ComprasSubNav />
        <EmptyState title="Recepción no encontrada" description="La recepción no existe o fue eliminada." />
      </div>
    )
  }

  const isDraft     = receipt.status === 'draft'
  const isConfirmed = receipt.status === 'confirmed'

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Recepciones', href: '/compras/recepciones' },
          { label: receipt.receipt_number },
        ]}
        actions={
          <div className="flex gap-2">
            {isDraft && (
              <>
                <Button size="sm" variant="secondary" onClick={() => setConfirmDelete(true)}>
                  Eliminar
                </Button>
                <Button size="sm" onClick={() => setConfirmConfirm(true)}>
                  Confirmar recepción
                </Button>
              </>
            )}
            {isConfirmed && (
              <Button
                size="sm"
                onClick={() => {
                  const params = new URLSearchParams({ receipt_id: receipt.id })
                  if (receipt.order_id) params.set('order_id', receipt.order_id)
                  router.push(`/compras/facturas/nueva?${params}`)
                }}
              >
                Crear factura proveedor
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

          {isConfirmed && (
            <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-sm text-sm text-green-700">
              ✓ Recepción confirmada. El stock fue actualizado en el depósito.
            </div>
          )}

          {/* Header card */}
          <div className="bg-white border border-zinc-200 rounded-sm px-5 py-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wide mb-1">Recepción de compra</p>
              <h1 className="text-[20px] font-bold text-zinc-900 tracking-tight">{receipt.receipt_number}</h1>
              <p className="text-[13px] text-zinc-500 mt-0.5">
                {receipt.contact?.legal_name ?? 'Sin proveedor'} · {receipt.warehouse?.name ?? 'Sin depósito'}
              </p>
            </div>
            <StatusBadge value={PURCHASE_RECEIPT_STATUS_LABEL[receipt.status]} />
          </div>

          {/* Metadata card */}
          <div className="bg-white border border-zinc-200 rounded-sm p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px]">
              <div>
                <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Sucursal</p>
                <p className="text-zinc-800">{receipt.branch?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Depósito</p>
                <p className="text-zinc-800">{receipt.warehouse?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Fecha de recepción</p>
                <p className="text-zinc-800">
                  {receipt.receipt_date ? new Date(receipt.receipt_date).toLocaleDateString('es-AR') : '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Creada</p>
                <p className="text-zinc-800">{new Date(receipt.created_at).toLocaleDateString('es-AR')}</p>
              </div>
              {receipt.buyer && (
                <div>
                  <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Comprador</p>
                  <p className="text-zinc-800">{receipt.buyer.name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Items card */}
          <div className="bg-white border border-zinc-200 rounded-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Descripción</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Cantidad</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Costo unitario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(receipt.items ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-zinc-400 text-sm">Sin ítems</td>
                  </tr>
                ) : (
                  (receipt.items ?? []).map(item => (
                    <tr key={item.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-2.5 text-zinc-900">{item.description}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700">
                        {parseFloat(item.quantity).toLocaleString('es-AR')}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {parseFloat(item.unit_cost) > 0
                          ? `$ ${parseFloat(item.unit_cost).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                          : <span className="text-zinc-400">—</span>
                        }
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {receipt.notes && (
            <div className="bg-white border border-zinc-200 rounded-sm px-5 py-4 text-[13px] text-zinc-700">
              <p className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wide mb-1.5">Notas</p>
              {receipt.notes}
            </div>
          )}

          {/* Order traceability card */}
          {receipt.order && (
            <div className="bg-white border border-zinc-200 rounded-sm px-5 py-4">
              <p className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wide mb-2">Orden de compra vinculada</p>
              <div
                className="flex items-center justify-between cursor-pointer hover:bg-zinc-50 -mx-5 px-5 py-1 rounded-sm"
                onClick={() => router.push(`/compras/ordenes/${receipt.order!.id}`)}
              >
                <span className="text-[13px] font-medium text-zinc-900">{receipt.order.order_number}</span>
                <StatusBadge value={PURCHASE_ORDER_STATUS_LABEL[receipt.order.status]} />
              </div>
            </div>
          )}

          {/* Supplier invoices traceability card */}
          {(receipt.supplierInvoices ?? []).length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-100">
                <p className="text-[12px] font-semibold text-zinc-500 uppercase tracking-wide">Facturas vinculadas</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-100">
                  <tr>
                    <th className="text-left px-4 py-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Número</th>
                    <th className="text-right px-4 py-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Total</th>
                    <th className="text-left px-4 py-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {(receipt.supplierInvoices ?? []).map(inv => (
                    <tr
                      key={inv.id}
                      className="hover:bg-zinc-50/50 cursor-pointer"
                      onClick={() => router.push(`/compras/facturas/${inv.id}`)}
                    >
                      <td className="px-4 py-2.5 text-zinc-900 font-medium text-[13px]">{inv.invoice_number}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700 text-[13px]">{formatARS(inv.total)}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge value={SUPPLIER_INVOICE_STATUS_LABEL[inv.status]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>

      <ConfirmDialog
        open={confirmConfirm}
        onOpenChange={setConfirmConfirm}
        title="Confirmar recepción"
        description={`¿Confirmás la recepción ${receipt.receipt_number}? El stock de los productos se actualizará en el depósito. Esta acción no puede deshacerse.`}
        variant="warning"
        confirmLabel="Confirmar"
        onConfirm={async () => { await doAction('/confirm'); setConfirmConfirm(false) }}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Eliminar recepción"
        description={`¿Estás seguro de que querés eliminar la recepción ${receipt.receipt_number}?`}
        variant="danger"
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
      />
    </div>
  )
}
