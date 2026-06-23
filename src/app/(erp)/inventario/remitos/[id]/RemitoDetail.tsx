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
import { InventarioSubNav } from '../../InventarioSubNav'
import type { DeliveryNote } from '../types'
import { DELIVERY_NOTE_STATUS_LABEL } from '../types'
import { fetchJson, getApiErrorMessage, isApiRequestError } from '@/lib/fetch-json'

const ORDER_STATUS_LABEL: Record<string, string> = {
  draft:       'Borrador',
  confirmed:   'Confirmado',
  in_progress: 'En proceso',
  delivered:   'Entregado',
  cancelled:   'Cancelado',
}

export function RemitoDetail({ id }: { id: string }) {
  const router = useRouter()
  const [note, setNote]       = useState<DeliveryNote | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [confirmIssue,  setConfirmIssue]  = useState(false)
  const [confirmAnnul,  setConfirmAnnul]  = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [actionError,   setActionError]   = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const d = await fetchJson<DeliveryNote>(`/api/v1/inventory/delivery-notes/${id}`)
        if (mounted) { setNote(d); setNotFound(false) }
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
      await fetchJson(`/api/v1/inventory/delivery-notes/${id}${endpoint}`, { method })
      setRefresh(r => r + 1)
      return true
    } catch (e) {
      setActionError(getApiErrorMessage(e))
      return false
    }
  }

  async function handleDelete() {
    const ok = await doAction('', 'DELETE')
    if (ok) router.push('/inventario/remitos')
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Remitos', href: '/inventario/remitos' }, { label: '…' }]} />
        <InventarioSubNav />
        <div className="flex-1 flex items-center justify-center">
          <span className="text-fg-subtle text-sm">Cargando…</span>
        </div>
      </div>
    )
  }

  if (notFound || !note) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Remitos', href: '/inventario/remitos' }, { label: 'No encontrado' }]} />
        <InventarioSubNav />
        <EmptyState title="Remito no encontrado" description="El remito no existe o fue eliminado." />
      </div>
    )
  }

  const isDraft     = note.status === 'draft'
  const isIssued    = note.status === 'issued'
  const isDelivered = note.status === 'delivered'

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Remitos', href: '/inventario/remitos' },
          { label: note.delivery_number },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link href={`/ventas/remitos/${id}/print`} target="_blank" rel="noopener noreferrer">
                Imprimir
              </Link>
            </Button>
            {isDraft && (
              <>
                <Button size="sm" variant="secondary" onClick={() => setConfirmDelete(true)}>
                  Eliminar
                </Button>
                <Button size="sm" onClick={() => setConfirmIssue(true)}>
                  Emitir remito
                </Button>
              </>
            )}
            {isIssued && (
              <>
                <Button size="sm" variant="ghost" onClick={() => setConfirmAnnul(true)}>
                  Anular
                </Button>
                <Button size="sm" onClick={async () => { await doAction('/deliver') }}>
                  Marcar entregado
                </Button>
              </>
            )}
            {isDelivered && (
              <Button size="sm" variant="ghost" onClick={() => setConfirmAnnul(true)}>
                Anular
              </Button>
            )}
          </div>
        }
      />
      <InventarioSubNav />

      <PageBody>
        <div className="max-w-4xl mx-auto flex flex-col gap-5">

          {actionError && (
            <div className="px-4 py-2 bg-danger-bg border border-danger rounded-sm text-sm text-danger">
              {actionError}
            </div>
          )}

          {(isIssued || isDelivered) && note.deducts_stock && (
            <div className="px-4 py-3 bg-success-bg border border-success rounded-sm text-sm text-success">
              ✓ Remito emitido. El stock fue descontado del depósito.
            </div>
          )}
          {(isIssued || isDelivered) && !note.deducts_stock && (
            <div className="px-4 py-3 bg-warning-bg border border-warning rounded-sm text-sm text-warning">
              El stock ya se descontó al confirmar el pedido de venta. Este remito documenta la entrega sin volver a mover stock.
            </div>
          )}

          {/* Header card */}
          <div className="bg-surface border border-border rounded-sm px-5 py-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide mb-1">Remito de entrega</p>
              <h1 className="text-[20px] font-bold text-fg tracking-tight">{note.delivery_number}</h1>
              <p className="text-[13px] text-fg-muted mt-0.5">
                {note.contact?.legal_name ?? 'Sin cliente'} · {note.warehouse?.name ?? 'Sin depósito'}
              </p>
            </div>
            <StatusBadge value={DELIVERY_NOTE_STATUS_LABEL[note.status]} />
          </div>

          {/* Metadata card */}
          <div className="bg-surface border border-border rounded-sm p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px]">
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Sucursal</p>
                <p className="text-fg">{note.branch?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Depósito</p>
                <p className="text-fg">{note.warehouse?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Fecha de entrega</p>
                <p className="text-fg">
                  {note.delivery_date ? new Date(note.delivery_date).toLocaleDateString('es-AR') : '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Creado</p>
                <p className="text-fg">{new Date(note.created_at).toLocaleDateString('es-AR')}</p>
              </div>
              {note.carrier && (
                <div>
                  <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Transportista</p>
                  <p className="text-fg">{note.carrier}</p>
                </div>
              )}
              {note.tracking_code && (
                <div>
                  <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Seguimiento</p>
                  <p className="text-fg">{note.tracking_code}</p>
                </div>
              )}
              {note.issuer && (
                <div>
                  <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Emitido por</p>
                  <p className="text-fg">{note.issuer.name}</p>
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
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Cantidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(note.items ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-fg-subtle text-sm">Sin ítems</td>
                  </tr>
                ) : (
                  (note.items ?? []).map(item => (
                    <tr key={item.id} className="hover:bg-surface-muted/50">
                      <td className="px-4 py-2.5 text-fg">{item.description}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">
                        {parseFloat(item.quantity).toLocaleString('es-AR')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {note.notes && (
            <div className="bg-surface border border-border rounded-sm px-5 py-4 text-[13px] text-fg-muted">
              <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide mb-1.5">Notas</p>
              {note.notes}
            </div>
          )}

          {/* Order traceability card */}
          {note.order && (
            <div className="bg-surface border border-border rounded-sm px-5 py-4">
              <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide mb-2">Pedido de venta vinculado</p>
              <div
                className="flex items-center justify-between cursor-pointer hover:bg-surface-muted -mx-5 px-5 py-1 rounded-sm"
                onClick={() => router.push(`/ventas/pedidos/${note.order!.id}`)}
              >
                <span className="text-[13px] font-medium text-fg">{note.order.order_number}</span>
                <StatusBadge value={ORDER_STATUS_LABEL[note.order.status] ?? note.order.status} />
              </div>
            </div>
          )}

        </div>
      </PageBody>

      <ConfirmDialog
        open={confirmIssue}
        onOpenChange={setConfirmIssue}
        title="Emitir remito"
        description={
          note.deducts_stock
            ? `¿Emitís el remito ${note.delivery_number}? El stock de los productos se descontará del depósito. Esta acción no puede deshacerse.`
            : `¿Emitís el remito ${note.delivery_number}? El stock ya fue descontado al confirmar el pedido; este remito solo documenta la entrega.`
        }
        variant="warning"
        confirmLabel="Emitir"
        onConfirm={async () => { await doAction('/issue'); setConfirmIssue(false) }}
      />

      <ConfirmDialog
        open={confirmAnnul}
        onOpenChange={setConfirmAnnul}
        title="Anular remito"
        description={
          note.deducts_stock
            ? `¿Anulás el remito ${note.delivery_number}? El stock descontado se restaurará en el depósito.`
            : `¿Anulás el remito ${note.delivery_number}?`
        }
        variant="danger"
        confirmLabel="Anular"
        onConfirm={async () => { await doAction('/annul'); setConfirmAnnul(false) }}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Eliminar remito"
        description={`¿Estás seguro de que querés eliminar el remito ${note.delivery_number}?`}
        variant="danger"
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
      />
    </div>
  )
}
