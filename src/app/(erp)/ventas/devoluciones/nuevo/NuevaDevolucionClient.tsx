'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { FormField } from '@/components/primitives/FormField'
import { TotalsFooter } from '@/components/erp/TotalsFooter'
import { SalesLineItemsEditor, calcTotals, makeEmptyLine } from '@/components/erp/SalesLineItemsEditor'
import type { LineItemInput } from '@/components/erp/SalesLineItemsEditor'
import { catalogProductRequiredMessage, findLineWithoutCatalogProduct } from '@/lib/sales-line-items-form'
import { VentasSubNav } from '../../VentasSubNav'
import type { Order } from '../../types'
import { fetchJson } from '@/lib/fetch-json'
import { notifyApiError } from '@/lib/notify'

type ReturnableItem = {
  id: string
  description: string
  quantity: string
  returned_qty?: string
  unit_price: string
}

export function NuevaDevolucionClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderId = searchParams.get('order_id') ?? ''
  const operationType = (searchParams.get('type') === 'exchange' ? 'exchange' : 'return') as 'return' | 'exchange'

  const [order, setOrder] = useState<Order | null>(null)
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [exchangeItems, setExchangeItems] = useState<LineItemInput[]>([makeEmptyLine()])
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!orderId) return
    void fetchJson<Order>(`/api/v1/sales/orders/${orderId}`).then(setOrder).catch(notifyApiError)
  }, [orderId])

  const maxFor = useCallback((item: ReturnableItem) => {
    const q = parseFloat(item.quantity)
    const r = parseFloat(item.returned_qty ?? '0')
    return Math.max(0, q - r)
  }, [])

  const returnedTotals = useMemo(() => {
    if (!order?.items) return { subtotal: 0, total: 0 }
    let subtotal = 0
    let total = 0
    for (const item of order.items as ReturnableItem[]) {
      const qty = parseFloat(quantities[item.id] || '0')
      if (qty <= 0) continue
      const unit = parseFloat(item.unit_price)
      const lineSub = unit * qty
      subtotal += lineSub
      total += lineSub
    }
    return { subtotal, total }
  }, [order, quantities])

  const exchangeTotals = useMemo(() => calcTotals(exchangeItems), [exchangeItems])
  const difference = parseFloat(exchangeTotals.total) - returnedTotals.total

  const handleSubmit = async () => {
    if (!orderId) return
    setServerError(null)

    const items = (order?.items ?? [])
      .map(item => ({ order_item_id: item.id, quantity: parseFloat(quantities[item.id] || '0') }))
      .filter(i => i.quantity > 0)

    if (items.length === 0) return

    const payload: Record<string, unknown> = {
      order_id: orderId,
      operation_type: operationType,
      items,
    }

    if (operationType === 'exchange') {
      const lineWithoutProduct = findLineWithoutCatalogProduct(exchangeItems)
      if (lineWithoutProduct >= 0) {
        setServerError(catalogProductRequiredMessage(lineWithoutProduct))
        return
      }

      payload.exchange_items = exchangeItems.map((item, idx) => ({
        product_id:   item.product_id!,
        variant_id:   item.variant_id!,
        description:  item.description,
        quantity:     parseFloat(item.quantity) || 0,
        unit_price:   parseFloat(item.unit_price) || 0,
        discount_pct: parseFloat(item.discount_pct) || 0,
        iva_rate:     item.iva_rate,
        sort_order:   idx,
      }))
    }

    setSaving(true)
    try {
      const created = await fetchJson<{ id: string }>('/api/v1/sales/returns', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      router.push(`/ventas/devoluciones/${created.id}`)
    } catch (e) {
      notifyApiError(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Ventas', href: '/ventas/presupuestos' },
          { label: 'Devoluciones', href: '/ventas/devoluciones' },
          { label: operationType === 'exchange' ? 'Nuevo cambio' : 'Nueva devolución' },
        ]}
      />
      <VentasSubNav />
      <PageBody>
        <div className="max-w-3xl mx-auto flex flex-col gap-4">
          {!orderId && <p className="text-danger">Falta order_id en la URL.</p>}
          {order && (
            <>
              <p className="text-[13px] text-fg-muted">Pedido {order.order_number}</p>
              <div className="bg-surface border border-border rounded-sm p-4 flex flex-col gap-3">
                <h2 className="font-semibold text-[13px]">Ítems a devolver</h2>
                {(order.items as ReturnableItem[]).map(item => (
                  <FormField key={item.id} label={`${item.description} (máx ${maxFor(item)})`} htmlFor={`qty-${item.id}`}>
                    <Input
                      id={`qty-${item.id}`}
                      type="number"
                      min={0}
                      max={maxFor(item)}
                      step="any"
                      value={quantities[item.id] ?? ''}
                      onChange={e => setQuantities(q => ({ ...q, [item.id]: e.target.value }))}
                    />
                  </FormField>
                ))}
              </div>

              {operationType === 'exchange' && (
                <div className="bg-surface border border-border rounded-sm p-4 flex flex-col gap-3">
                  <h2 className="font-semibold text-[13px]">Ítems nuevos a entregar</h2>
                  <SalesLineItemsEditor items={exchangeItems} onChange={setExchangeItems} />
                </div>
              )}

              {operationType === 'exchange' && (
                <TotalsFooter
                  subtotal={difference}
                  taxAmount={0}
                  total={difference}
                />
              )}

              {serverError && (
                <p className="text-[13px] text-danger" role="alert">
                  {serverError}
                </p>
              )}

              <Button onClick={() => void handleSubmit()} disabled={saving}>
                {saving ? 'Guardando…' : 'Crear borrador'}
              </Button>
            </>
          )}
        </div>
      </PageBody>
    </div>
  )
}
