'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { EmptyState } from '@/components/erp/EmptyState'
import { PageActionBar, type PageAction } from '@/components/erp/PageActionBar'
import { ShipmentStatusBadge } from '@/components/erp'
import { formatARS } from '@/components/primitives/CurrencyInput'
import {
  FULFILLMENT_KIND_LABEL,
  SHIPMENT_STATUS_LABEL,
  canTransitionShipment,
} from '@/modules/logistics/logistics.constants'
import { fetchJson } from '@/lib/fetch-json'
import { notifyApiError } from '@/lib/notify'
import { LogisticaSubNav } from '../../LogisticaSubNav'
import type { ShipmentDetailData } from '../../types'
import { DispatchDialog } from './DispatchDialog'
import { EventDialog } from './EventDialog'

const EVENT_SOURCE_LABEL: Record<string, string> = {
  system:  'Sistema',
  manual:  'Manual',
  webhook: 'Webhook',
  poll:    'Consulta automática',
}

function formatAddress(s: ShipmentDetailData): string | null {
  const first = `${s.ship_street ?? ''}${s.ship_number ? ` ${s.ship_number}` : ''}`.trim()
  const floorApt = [s.ship_floor, s.ship_apartment].filter(Boolean).join(' ')
  const parts = [first, floorApt, s.ship_city, s.ship_province, s.ship_postal_code, s.ship_country].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
}

export function ShipmentDetail({ id }: { id: string }) {
  const [shipment, setShipment] = useState<ShipmentDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)

  const [dispatchOpen, setDispatchOpen] = useState(false)
  const [eventOpen, setEventOpen] = useState(false)
  const [confirmDeliver, setConfirmDeliver] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [transitioning, setTransitioning] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const data = await fetchJson<ShipmentDetailData>(`/api/v1/logistics/shipments/${id}`)
        if (!cancelled) setShipment(data)
      } catch {
        if (!cancelled) setShipment(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id, refresh])

  async function handleDeliver() {
    setConfirmDeliver(false)
    setTransitioning(true)
    try {
      await fetchJson(`/api/v1/logistics/shipments/${id}/events`, {
        method: 'POST',
        body: JSON.stringify({ status: 'delivered', description: 'Entregado' }),
      })
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    } finally {
      setTransitioning(false)
    }
  }

  async function handleCancel() {
    setConfirmCancel(false)
    setTransitioning(true)
    try {
      await fetchJson(`/api/v1/logistics/shipments/${id}/cancel`, { method: 'POST' })
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    } finally {
      setTransitioning(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Logística', href: '/logistica/envios' }, { label: 'Envíos', href: '/logistica/envios' }, { label: '…' }]} />
        <LogisticaSubNav />
        <div className="flex-1 flex items-center justify-center text-[13px] text-fg-subtle">Cargando…</div>
      </div>
    )
  }

  if (!shipment) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Logística', href: '/logistica/envios' }, { label: 'Envíos', href: '/logistica/envios' }, { label: 'No encontrado' }]} />
        <LogisticaSubNav />
        <div className="flex-1 flex items-center justify-center">
          <EmptyState title="Envío no encontrado" description="El envío no existe o fue eliminado." />
        </div>
      </div>
    )
  }

  const canDispatch = canTransitionShipment(shipment.status, 'dispatched')
  const canDeliver  = canTransitionShipment(shipment.status, 'delivered')
  const canCancel   = canTransitionShipment(shipment.status, 'cancelled')
  const hasNextEvent = !canDispatch &&
    Object.keys(SHIPMENT_STATUS_LABEL).some(s =>
      s !== 'cancelled' && canTransitionShipment(shipment.status, s as ShipmentDetailData['status']),
    )
  const address = formatAddress(shipment)
  const events = shipment.events ?? []
  const items = shipment.items ?? []

  const primaryAction: PageAction | null = canDispatch
    ? { id: 'dispatch', label: 'Despachar', onClick: () => setDispatchOpen(true), disabled: transitioning }
    : canDeliver
      ? { id: 'deliver', label: 'Marcar entregado', onClick: () => setConfirmDeliver(true), disabled: transitioning }
      : null

  const secondaryActions: PageAction[] = [
    ...(hasNextEvent ? [{ id: 'event', label: 'Registrar evento', onClick: () => setEventOpen(true), disabled: transitioning }] : []),
    ...(canCancel ? [{ id: 'cancel', label: 'Cancelar envío', onClick: () => setConfirmCancel(true), disabled: transitioning, variant: 'destructive' as const }] : []),
  ]

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Logística', href: '/logistica/envios' },
          { label: 'Envíos', href: '/logistica/envios' },
          { label: shipment.shipment_number },
        ]}
        actions={<PageActionBar primary={primaryAction} secondary={secondaryActions} />}
      />
      <LogisticaSubNav />

      <PageBody>
        <div className="max-w-4xl mx-auto flex flex-col gap-5">

          {/* Header */}
          <div className="bg-surface border border-border rounded-sm px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide mb-1">Envío</p>
              <h1 className="text-[20px] font-bold text-fg tracking-tight">{shipment.shipment_number}</h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-fg-muted">
                {shipment.carrierAccount?.name ?? FULFILLMENT_KIND_LABEL[shipment.provider_kind]}
              </span>
              <ShipmentStatusBadge status={shipment.status} />
            </div>
          </div>

          {shipment.status === 'failed' && shipment.failure_reason && (
            <div role="status" className="rounded-sm border border-danger bg-danger-bg px-4 py-3 text-[13px] text-danger">
              Último intento de entrega fallido: {shipment.failure_reason}
            </div>
          )}

          {/* Info */}
          <div className="bg-surface border border-border rounded-sm p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px]">
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Pedido</p>
                {shipment.salesOrder ? (
                  <Link href={`/ventas/pedidos/${shipment.salesOrder.id}`} className="text-brand-600 hover:underline">
                    {shipment.salesOrder.order_number}
                  </Link>
                ) : <span className="text-fg-subtle">—</span>}
              </div>
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Transporte</p>
                <p className="text-fg">{shipment.carrierAccount?.name ?? FULFILLMENT_KIND_LABEL[shipment.provider_kind]}</p>
                <p className="text-[12px] text-fg-muted">{FULFILLMENT_KIND_LABEL[shipment.provider_kind]}</p>
              </div>
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Seguimiento</p>
                {shipment.tracking_number ? (
                  shipment.tracking_url ? (
                    <a href={shipment.tracking_url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline tabular-nums">
                      {shipment.tracking_number}
                    </a>
                  ) : (
                    <p className="text-fg tabular-nums">{shipment.tracking_number}</p>
                  )
                ) : <span className="text-fg-subtle">—</span>}
              </div>
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Costo</p>
                <p className="text-fg tabular-nums">
                  {parseFloat(shipment.shipping_cost) > 0 ? formatARS(shipment.shipping_cost) : '—'}
                </p>
              </div>
              {shipment.provider_kind === 'in_house' && (
                <>
                  <div>
                    <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Chofer</p>
                    <p className="text-fg">{shipment.driver?.name ?? <span className="text-fg-subtle">Sin asignar</span>}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Vehículo</p>
                    <p className="text-fg">{shipment.vehicle_ref ?? <span className="text-fg-subtle">—</span>}</p>
                  </div>
                </>
              )}
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Fecha prometida</p>
                <p className="text-fg">
                  {shipment.promised_date ? new Date(shipment.promised_date).toLocaleDateString('es-AR') : <span className="text-fg-subtle">—</span>}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Entregado</p>
                <p className="text-fg">
                  {shipment.delivered_at ? new Date(shipment.delivered_at).toLocaleString('es-AR') : <span className="text-fg-subtle">—</span>}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border pt-4 mt-4 text-[13px]">
              <div>
                <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-fg-subtle">Destino</p>
                <p className="text-fg font-medium">{shipment.ship_to_name ?? '—'}</p>
                <p className="text-fg-muted">{address ?? '—'}</p>
                {shipment.ship_to_phone && <p className="text-[12px] text-fg-muted">Tel: {shipment.ship_to_phone}</p>}
              </div>
              {shipment.delivery_notes && (
                <div>
                  <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-fg-subtle">Indicaciones de entrega</p>
                  <p className="text-fg-muted whitespace-pre-line">{shipment.delivery_notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="bg-surface border border-border rounded-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h2 className="text-[13px] font-semibold text-fg">Ítems del envío</h2>
            </div>
            {items.length > 0 ? (
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-surface-muted border-b border-border">
                    <th className="px-4 py-2 text-left font-medium text-fg-muted">Descripción</th>
                    <th className="px-4 py-2 text-right font-medium text-fg-muted">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 text-fg">{item.description}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">{parseFloat(item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-4 py-8 text-center text-[13px] text-fg-subtle">Sin ítems</div>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-surface border border-border rounded-sm p-5">
            <h2 className="text-[13px] font-semibold text-fg mb-3">Seguimiento</h2>
            {events.length === 0 ? (
              <p className="text-[13px] text-fg-muted">Sin eventos registrados.</p>
            ) : (
              <ol className="flex flex-col gap-0">
                {[...events].reverse().map((event, idx) => (
                  <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                    <div className="flex flex-col items-center">
                      <span className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${idx === 0 ? 'bg-brand-600' : 'bg-border-strong'}`} />
                      {idx < events.length - 1 && <span className="w-px flex-1 bg-border" />}
                    </div>
                    <div className="min-w-0 pb-1">
                      <p className="text-[13px] text-fg font-medium">
                        {SHIPMENT_STATUS_LABEL[event.status]}
                        {event.description && event.description !== SHIPMENT_STATUS_LABEL[event.status] && (
                          <span className="font-normal text-fg-muted"> — {event.description}</span>
                        )}
                      </p>
                      <p className="text-[12px] text-fg-muted">
                        {new Date(event.occurred_at).toLocaleString('es-AR')} · {EVENT_SOURCE_LABEL[event.source] ?? event.source}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </PageBody>

      <DispatchDialog
        open={dispatchOpen}
        onOpenChange={setDispatchOpen}
        shipment={shipment}
        onDispatched={() => setRefresh(r => r + 1)}
      />

      <EventDialog
        open={eventOpen}
        onOpenChange={setEventOpen}
        shipment={shipment}
        onRecorded={() => setRefresh(r => r + 1)}
      />

      <ConfirmDialog
        open={confirmDeliver}
        onOpenChange={setConfirmDeliver}
        title="Marcar entregado"
        description={`¿Confirmar la entrega del envío ${shipment.shipment_number}? Si el pedido queda completo, pasa a entregado.`}
        confirmLabel="Marcar entregado"
        variant="warning"
        onConfirm={handleDeliver}
      />

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancelar envío"
        description={`¿Cancelar el envío ${shipment.shipment_number}? Las cantidades vuelven a quedar pendientes en el pedido.`}
        confirmLabel="Cancelar envío"
        variant="danger"
        onConfirm={handleCancel}
      />
    </div>
  )
}
