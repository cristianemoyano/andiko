'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/primitives/Button'
import { ShipmentStatusBadge } from '@/components/erp'
import { FULFILLMENT_KIND_LABEL, type ShipmentStatus, type FulfillmentKind } from '@/modules/logistics/logistics.constants'
import { formatShipmentQty } from '@/modules/sales/order-shipment-progress'
import { fetchJson } from '@/lib/fetch-json'

type OrderShipmentRow = {
  id: string
  shipment_number: string
  status: ShipmentStatus
  provider_kind: FulfillmentKind
  tracking_number: string | null
  tracking_url: string | null
  created_at: string
  carrierAccount?: { id: string; name: string; kind: FulfillmentKind } | null
  driver?: { id: string; name: string } | null
}

export interface OrderShipmentsSectionProps {
  orderId: string
  /** Re-fetch cuando el padre incrementa su contador (pattern de refresh del proyecto). */
  refresh: number
  canCreate: boolean
  onCreateRequest: () => void
  shippedQty?: number
  totalShippableQty?: number
  hasShippableLines?: boolean
}

export function OrderShipmentsSection({
  orderId,
  refresh,
  canCreate,
  onCreateRequest,
  shippedQty = 0,
  totalShippableQty = 0,
  hasShippableLines = false,
}: OrderShipmentsSectionProps) {
  const [shipments, setShipments] = useState<OrderShipmentRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ sales_order_id: orderId, page: '1', limit: '50' })
        const res = await fetchJson<{ data: OrderShipmentRow[] }>(`/api/v1/logistics/shipments?${params}`)
        if (!cancelled) setShipments(Array.isArray(res.data) ? res.data : [])
      } catch {
        if (!cancelled) setShipments([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [orderId, refresh])

  return (
    <div className="bg-surface border border-border rounded-sm p-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="text-[13px] font-semibold text-fg">Envíos</h2>
        {canCreate && (
          <Button variant="secondary" size="xs" onClick={onCreateRequest}>
            + Generar envío
          </Button>
        )}
      </div>
      <p className="text-[12px] text-fg-muted mb-3">
        Los envíos se registran cuando despachás con courier o reparto propio. Retiro en sucursal no requiere envío.
      </p>
      {!loading && shipments.length > 0 && hasShippableLines && (
        <p className="text-[12px] font-medium text-fg mb-3 tabular-nums">
          {shipments.length} envío{shipments.length !== 1 ? 's' : ''} · {formatShipmentQty(shippedQty)}/{formatShipmentQty(totalShippableQty)} unidades enviadas
        </p>
      )}
      {loading ? (
        <p className="text-[13px] text-fg-muted">Cargando envíos…</p>
      ) : shipments.length === 0 ? (
        <p className="text-[13px] text-fg-muted">
          Sin envíos registrados.
          {canCreate ? ' Generá uno cuando quieras despachar.' : ''}
        </p>
      ) : (
        <div className="space-y-2">
          {shipments.map(shipment => (
            <div key={shipment.id} className="flex items-center justify-between gap-3 rounded-sm border border-border px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[13px] font-medium text-fg">{shipment.shipment_number}</p>
                  <ShipmentStatusBadge status={shipment.status} />
                </div>
                <p className="text-[12px] text-fg-muted">
                  {shipment.carrierAccount?.name ?? FULFILLMENT_KIND_LABEL[shipment.provider_kind]}
                  {shipment.driver ? ` · ${shipment.driver.name}` : ''}
                  {shipment.tracking_number ? (
                    <>
                      {' · '}
                      {shipment.tracking_url ? (
                        <a
                          href={shipment.tracking_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-accent hover:underline"
                        >
                          {shipment.tracking_number}
                        </a>
                      ) : shipment.tracking_number}
                    </>
                  ) : ''}
                  {' · '}{new Date(shipment.created_at).toLocaleDateString('es-AR')}
                </p>
              </div>
              <Button variant="ghost" size="xs" asChild>
                <Link href={`/logistica/envios/${shipment.id}`}>Ver envío</Link>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
