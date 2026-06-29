'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { Button } from '@/components/primitives/Button'
import { StatusBadge } from '@/components/primitives/Badge'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { EmptyState } from '@/components/erp/EmptyState'
import { OwnerAttachmentsSection } from '@/components/erp/OwnerAttachmentsSection'
import { ComprasSubNav } from '../../ComprasSubNav'
import type { PurchaseReceipt } from '../../types'
import { PURCHASE_ORDER_STATUS_LABEL, PURCHASE_RECEIPT_STATUS_LABEL, SUPPLIER_INVOICE_STATUS_LABEL } from '../../types'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { fetchJson, getApiErrorMessage, isApiRequestError } from '@/lib/fetch-json'

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
        const d = await fetchJson<PurchaseReceipt>(`/api/v1/purchases/receipts/${id}`)
        if (mounted) { setReceipt(d); setNotFound(false) }
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
      await fetchJson(`/api/v1/purchases/receipts/${id}${endpoint}`, { method })
      setRefresh(r => r + 1)
      return true
    } catch (e) {
      setActionError(getApiErrorMessage(e))
      return false
    }
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
          <span className="text-fg-subtle text-sm">Cargando…</span>
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
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link href={`/compras/recepciones/${id}/print`} target="_blank" rel="noopener noreferrer">
                Imprimir
              </Link>
            </Button>
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

      <PageBody>
        <div className="max-w-4xl mx-auto flex flex-col gap-5">

          {actionError && (
            <div className="px-4 py-2 bg-danger-bg border border-danger rounded-sm text-sm text-danger">
              {actionError}
            </div>
          )}

          {isConfirmed && (
            <div className="px-4 py-3 bg-success-bg border border-success rounded-sm text-sm text-success">
              ✓ Recepción confirmada. El stock fue actualizado en el depósito.
            </div>
          )}

          {/* Header card */}
          <div className="bg-surface border border-border rounded-sm px-5 py-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide mb-1">Recepción de compra</p>
              <h1 className="text-[20px] font-bold text-fg tracking-tight">{receipt.receipt_number}</h1>
              <p className="text-[13px] text-fg-muted mt-0.5">
                {receipt.contact?.legal_name ?? 'Sin proveedor'} · {receipt.warehouse?.name ?? 'Sin depósito'}
              </p>
            </div>
            <StatusBadge value={PURCHASE_RECEIPT_STATUS_LABEL[receipt.status]} />
          </div>

          {/* Metadata card */}
          <div className="bg-surface border border-border rounded-sm p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px]">
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Sucursal</p>
                <p className="text-fg">{receipt.branch?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Depósito</p>
                <p className="text-fg">{receipt.warehouse?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Fecha de recepción</p>
                <p className="text-fg">
                  {receipt.receipt_date ? new Date(receipt.receipt_date).toLocaleDateString('es-AR') : '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Creada</p>
                <p className="text-fg">{new Date(receipt.created_at).toLocaleDateString('es-AR')}</p>
              </div>
              {receipt.buyer && (
                <div>
                  <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Comprador</p>
                  <p className="text-fg">{receipt.buyer.name}</p>
                </div>
              )}
            </div>
          </div>

          <OwnerAttachmentsSection
            ownerType="purchase_receipt"
            ownerId={receipt.id}
            title="Remito / documento de recepción"
          />

          {/* Items card */}
          <div className="bg-surface border border-border rounded-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Descripción</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Cantidad</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Costo unitario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(receipt.items ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-fg-subtle text-sm">Sin ítems</td>
                  </tr>
                ) : (
                  (receipt.items ?? []).map(item => (
                    <tr key={item.id} className="hover:bg-surface-muted/50">
                      <td className="px-4 py-2.5 text-fg">{item.description}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">
                        {parseFloat(item.quantity).toLocaleString('es-AR')}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {parseFloat(item.unit_cost) > 0
                          ? `$ ${parseFloat(item.unit_cost).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                          : <span className="text-fg-subtle">—</span>
                        }
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {receipt.notes && (
            <div className="bg-surface border border-border rounded-sm px-5 py-4 text-[13px] text-fg-muted">
              <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide mb-1.5">Notas</p>
              {receipt.notes}
            </div>
          )}

          {/* Order traceability card */}
          {receipt.order && (
            <div className="bg-surface border border-border rounded-sm px-5 py-4">
              <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide mb-2">Orden de compra vinculada</p>
              <div
                className="flex items-center justify-between cursor-pointer hover:bg-surface-muted -mx-5 px-5 py-1 rounded-sm"
                onClick={() => router.push(`/compras/ordenes/${receipt.order!.id}`)}
              >
                <span className="text-[13px] font-medium text-fg">{receipt.order.order_number}</span>
                <StatusBadge value={PURCHASE_ORDER_STATUS_LABEL[receipt.order.status]} />
              </div>
            </div>
          )}

          {/* Supplier invoices traceability card */}
          {(receipt.supplierInvoices ?? []).length > 0 && (
            <div className="bg-surface border border-border rounded-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <p className="text-[12px] font-semibold text-fg-muted uppercase tracking-wide">Facturas vinculadas</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-surface-muted border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Número</th>
                    <th className="text-right px-4 py-2 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Total</th>
                    <th className="text-left px-4 py-2 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(receipt.supplierInvoices ?? []).map(inv => (
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
            </div>
          )}

        </div>
      </PageBody>

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
