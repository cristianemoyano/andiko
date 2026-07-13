'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { Button } from '@/components/primitives/Button'
import { StatusBadge } from '@/components/primitives/Badge'
import { Dialog, DialogFooter } from '@/components/primitives/Dialog'
import { FormField } from '@/components/primitives/FormField'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { EmptyState } from '@/components/erp/EmptyState'
import { ProduccionSubNav } from '../../ProduccionSubNav'
import type { ProductionOrder } from '../../types'
import { PRODUCTION_ORDER_STATUS_LABEL } from '../../types'
import { fetchJson, getApiErrorMessage, isApiRequestError } from '@/lib/fetch-json'

interface OrdenDetailProps {
  id: string
}

export function OrdenDetail({ id }: OrdenDetailProps) {
  const router = useRouter()
  const [order, setOrder]       = useState<ProductionOrder | null>(null)
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [refresh, setRefresh]   = useState(0)

  const [confirmRelease, setConfirmRelease] = useState(false)
  const [confirmCancel,  setConfirmCancel]  = useState(false)
  const [confirmDelete,  setConfirmDelete]  = useState(false)
  const [completeOpen,   setCompleteOpen]   = useState(false)
  const [producedQty,    setProducedQty]    = useState('')
  const [actionError,    setActionError]    = useState<string | null>(null)
  const [busy,           setBusy]           = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const d = await fetchJson<ProductionOrder>(`/api/v1/production/orders/${id}`)
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

  async function doAction(endpoint: string, method = 'POST', body?: unknown) {
    setActionError(null)
    setBusy(true)
    try {
      await fetchJson(`/api/v1/production/orders/${id}${endpoint}`, {
        method,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      })
      setRefresh(r => r + 1)
      return true
    } catch (e) {
      setActionError(getApiErrorMessage(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    const ok = await doAction('', 'DELETE')
    if (ok) router.push('/produccion/ordenes')
  }

  async function handleComplete() {
    const qty = parseFloat(producedQty)
    const ok = await doAction('/complete', 'POST', { produced_quantity: Number.isFinite(qty) && qty > 0 ? qty : undefined })
    if (ok) setCompleteOpen(false)
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Órdenes de producción', href: '/produccion/ordenes' }, { label: '…' }]} />
        <ProduccionSubNav />
        <div className="flex-1 flex items-center justify-center">
          <span className="text-fg-subtle text-sm">Cargando…</span>
        </div>
      </div>
    )
  }

  if (notFound || !order) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Órdenes de producción', href: '/produccion/ordenes' }, { label: 'No encontrada' }]} />
        <ProduccionSubNav />
        <EmptyState title="Orden no encontrada" description="La orden de producción no existe o fue eliminada." />
      </div>
    )
  }

  const isDraft      = order.status === 'draft'
  const isReleased   = order.status === 'released'
  const isInProcess  = order.status === 'in_process'
  const isDone       = order.status === 'done'
  const isCancelled  = order.status === 'cancelled'

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Órdenes de producción', href: '/produccion/ordenes' },
          { label: order.order_number },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            {isDraft && (
              <>
                <Button size="sm" variant="secondary" onClick={() => setConfirmDelete(true)} disabled={busy}>
                  Eliminar
                </Button>
                <Button size="sm" onClick={() => setConfirmRelease(true)} disabled={busy}>
                  Liberar
                </Button>
              </>
            )}
            {isReleased && (
              <Button size="sm" variant="secondary" onClick={() => doAction('/start')} disabled={busy}>
                Iniciar
              </Button>
            )}
            {(isReleased || isInProcess) && (
              <Button size="sm" onClick={() => { setProducedQty(order.planned_quantity); setCompleteOpen(true) }} disabled={busy}>
                Completar
              </Button>
            )}
            {!isDone && !isCancelled && (
              <Button size="sm" variant="danger" onClick={() => setConfirmCancel(true)} disabled={busy}>
                Cancelar
              </Button>
            )}
          </div>
        }
      />
      <ProduccionSubNav />

      <PageBody>
        <div className="max-w-4xl mx-auto flex flex-col gap-5">

          {actionError && (
            <div className="px-4 py-2 bg-danger-bg border border-danger rounded-sm text-sm text-danger">
              {actionError}
            </div>
          )}

          <div className="bg-surface border border-border rounded-sm px-5 py-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide mb-1">Orden de producción</p>
              <h1 className="text-[20px] font-bold text-fg tracking-tight">{order.order_number}</h1>
              <p className="text-[13px] text-fg-muted mt-0.5">
                {order.variant?.product?.name ?? order.variant?.name ?? order.variant?.sku ?? 'Sin producto'} · {order.branch?.name ?? 'Sin sucursal'}
              </p>
            </div>
            <StatusBadge value={PRODUCTION_ORDER_STATUS_LABEL[order.status]} />
          </div>

          <div className="bg-surface border border-border rounded-sm p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px]">
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Depósito</p>
                <p className="text-fg">{order.warehouse?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Cantidad planificada</p>
                <p className="text-fg tabular-nums">{parseFloat(order.planned_quantity).toLocaleString('es-AR')}</p>
              </div>
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Cantidad producida</p>
                <p className="text-fg tabular-nums">{parseFloat(order.produced_quantity).toLocaleString('es-AR')}</p>
              </div>
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Fecha programada</p>
                <p className="text-fg">{order.scheduled_date ? new Date(order.scheduled_date).toLocaleDateString('es-AR') : '—'}</p>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <p className="text-[12px] font-semibold text-fg-muted uppercase tracking-wide">Consumo de insumos</p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-surface-muted border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Insumo</th>
                  <th className="text-right px-4 py-2 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Planificado</th>
                  <th className="text-right px-4 py-2 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Consumido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(order.lines ?? []).length === 0 ? (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-fg-subtle text-sm">Sin componentes</td></tr>
                ) : (
                  order.lines.map(line => (
                    <tr key={line.id}>
                      <td className="px-4 py-2.5 text-fg">
                        {line.component?.product?.name ?? line.component?.name ?? line.component?.sku ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">{parseFloat(line.planned_quantity).toLocaleString('es-AR')}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">{parseFloat(line.consumed_quantity).toLocaleString('es-AR')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {order.notes && (
            <div className="bg-surface border border-border rounded-sm px-5 py-4 text-[13px] text-fg-muted">
              <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide mb-1.5">Notas</p>
              {order.notes}
            </div>
          )}

        </div>
      </PageBody>

      <ConfirmDialog
        open={confirmRelease}
        onOpenChange={setConfirmRelease}
        title="Liberar orden de producción"
        description={`Se consumirán los insumos de la receta para la orden ${order.order_number}. ¿Confirmás?`}
        variant="warning"
        confirmLabel="Liberar"
        onConfirm={async () => { await doAction('/release'); setConfirmRelease(false) }}
      />

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancelar orden de producción"
        description={`¿Estás seguro de que querés cancelar la orden ${order.order_number}? ${isReleased || isInProcess ? 'Se revertirá el consumo de insumos.' : ''}`}
        variant="danger"
        confirmLabel="Cancelar orden"
        onConfirm={async () => { await doAction('/cancel'); setConfirmCancel(false) }}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Eliminar orden de producción"
        description={`¿Estás seguro de que querés eliminar la orden ${order.order_number}?`}
        variant="danger"
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
      />

      <Dialog
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        title="Completar orden de producción"
        description="Ingresá la cantidad real producida. Se dará de alta el stock del producto terminado y se recalculará su costo."
        size="sm"
        footer={
          <DialogFooter error={actionError}>
            <Button size="sm" variant="secondary" onClick={() => setCompleteOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleComplete} disabled={busy}>
              {busy ? 'Completando…' : 'Completar'}
            </Button>
          </DialogFooter>
        }
      >
        <FormField label="Cantidad producida" required>
          <input
            type="number"
            min="0"
            step="0.0001"
            value={producedQty}
            onChange={e => setProducedQty(e.target.value)}
            className="w-full h-9 px-3 text-sm border border-border rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </FormField>
      </Dialog>
    </div>
  )
}
