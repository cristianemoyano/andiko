'use client'

import { formatARS } from '@/components/primitives/CurrencyInput'
import type { ProductType } from '@/modules/catalog/product.model'
import { formatShipmentQty } from '@/modules/sales/order-shipment-progress'
import { NonShippableLineBadge } from './NonShippableLineBadge'

export type SaleDocumentLineItem = {
  id: string
  description: string
  quantity: string
  unit_price: string
  discount_pct: string
  iva_rate: string
  total: string
  product_type?: ProductType | null
  shipped_qty?: string | null
}

export interface SaleDocumentLineItemsReadOnlyProps {
  items: SaleDocumentLineItem[]
  emptyMessage?: string
  showShipmentColumns?: boolean
}

function lineShippedDisplay(item: SaleDocumentLineItem): string {
  if (item.product_type === 'service') return '—'
  return formatShipmentQty(parseFloat(item.shipped_qty ?? '0') || 0)
}

function linePendingDisplay(item: SaleDocumentLineItem): string {
  if (item.product_type === 'service') return '—'
  const qty = parseFloat(item.quantity) || 0
  const shipped = parseFloat(item.shipped_qty ?? '0') || 0
  return formatShipmentQty(Math.max(0, qty - shipped))
}

export function SaleDocumentLineItemsReadOnly({
  items,
  emptyMessage = 'Sin ítems',
  showShipmentColumns = false,
}: SaleDocumentLineItemsReadOnlyProps) {
  if (items.length === 0) {
    return <div className="px-4 py-8 text-center text-[13px] text-fg-subtle">{emptyMessage}</div>
  }

  return (
    <>
      <div className="md:hidden divide-y divide-border">
        {items.map(item => (
          <div key={item.id} className="px-4 py-3 space-y-1.5">
            <p className="text-[13px] font-medium text-fg leading-snug">
              {item.description}
              {item.product_type === 'service' ? <NonShippableLineBadge /> : null}
            </p>
            <div className="flex items-center justify-between gap-3 text-[12px] text-fg-muted">
              <span>
                {item.quantity} × {formatARS(item.unit_price)}
                {parseFloat(item.discount_pct) > 0 ? ` · −${item.discount_pct}%` : ''}
              </span>
              <span className="tabular-nums text-fg font-medium">{formatARS(item.total)}</span>
            </div>
            {showShipmentColumns && (
              <p className="text-[11px] text-fg-subtle tabular-nums">
                Enviado: {lineShippedDisplay(item)} · Pendiente: {linePendingDisplay(item)}
              </p>
            )}
            <p className="text-[11px] text-fg-subtle">IVA {item.iva_rate}%</p>
          </div>
        ))}
      </div>

      <table className="hidden md:table w-full text-[12px]">
        <thead>
          <tr className="bg-surface-muted border-b border-border">
            <th className="px-4 py-2 text-left font-medium text-fg-muted">Descripción</th>
            <th className="px-4 py-2 text-right font-medium text-fg-muted">Cant.</th>
            {showShipmentColumns && (
              <>
                <th className="px-4 py-2 text-right font-medium text-fg-muted">Enviado</th>
                <th className="px-4 py-2 text-right font-medium text-fg-muted">Pendiente</th>
              </>
            )}
            <th className="px-4 py-2 text-right font-medium text-fg-muted">P. unitario</th>
            <th className="px-4 py-2 text-right font-medium text-fg-muted">Desc.</th>
            <th className="px-4 py-2 text-right font-medium text-fg-muted">IVA</th>
            <th className="px-4 py-2 text-right font-medium text-fg-muted">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} className="border-b border-border last:border-0">
              <td className="px-4 py-2.5 text-fg">
                {item.description}
                {item.product_type === 'service' ? <NonShippableLineBadge /> : null}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">{item.quantity}</td>
              {showShipmentColumns && (
                <>
                  <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">
                    {lineShippedDisplay(item)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">
                    {linePendingDisplay(item)}
                  </td>
                </>
              )}
              <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">{formatARS(item.unit_price)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">
                {parseFloat(item.discount_pct) > 0 ? `${item.discount_pct}%` : '—'}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">{item.iva_rate}%</td>
              <td className="px-4 py-2.5 text-right tabular-nums font-medium text-fg">{formatARS(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
