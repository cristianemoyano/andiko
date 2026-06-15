'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { Textarea } from '@/components/primitives/Textarea'
import { DatePicker } from '@/components/primitives/DatePicker'
import { SearchableSelect } from '@/components/erp/SearchableSelect'
import type { SearchableSelectOption } from '@/components/erp/SearchableSelect'
import { BranchSelectField } from '@/components/erp/BranchSelectField'
import { InventarioSubNav } from '../../InventarioSubNav'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

interface RemitoItem {
  order_item_id: string | null
  product_id: string | null
  variant_id: string | null
  description: string
  quantity: string
}

interface OrderItem {
  id: string
  product_id: string | null
  variant_id: string | null
  description: string
  quantity: string
}

interface OrderLoaded {
  id: string
  order_number: string
  status: string
  branch_id: string | null
  contact_id: string | null
  contact?: { id: string; legal_name: string; trade_name: string | null } | null
  items?: OrderItem[]
}

export function NuevoRemitoClient() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const orderId      = searchParams.get('order_id')

  const [branchId,           setBranchId]           = useState<string | null>(null)
  const [contactId,          setContactId]          = useState<string | null>(null)
  const [contactInitialOpts, setContactInitialOpts] = useState<SearchableSelectOption[]>([])
  const [warehouseId,        setWarehouseId]        = useState<string | null>(null)
  const [deliveryDate,       setDeliveryDate]       = useState<Date | null>(new Date())
  const [carrier,            setCarrier]            = useState('')
  const [trackingCode,       setTrackingCode]       = useState('')
  const [notes,              setNotes]              = useState('')
  const [items,              setItems]              = useState<RemitoItem[]>([])
  const [order,              setOrder]              = useState<OrderLoaded | null>(null)
  const [saving,             setSaving]             = useState(false)
  const [serverError,        setServerError]        = useState<string | null>(null)

  const searchCustomers = useCallback(async (q: string): Promise<SearchableSelectOption[]> => {
    try {
      const data = await fetchJson<{ data: Array<{ id: string; legal_name: string; trade_name: string | null }> }>(
        `/api/v1/contacts?search=${encodeURIComponent(q)}&limit=20&type=customer`,
      )
      return (data.data ?? []).map(c => ({ value: c.id, label: c.legal_name, sublabel: c.trade_name ?? undefined }))
    } catch {
      return []
    }
  }, [])

  const searchWarehouses = useCallback(async (q: string): Promise<SearchableSelectOption[]> => {
    try {
      const data = await fetchJson<{ data: Array<{ id: string; name: string }> }>(
        `/api/v1/inventory/warehouses?search=${encodeURIComponent(q)}&limit=20`,
      )
      return (data.data ?? []).map(w => ({ value: w.id, label: w.name }))
    } catch {
      return []
    }
  }, [])

  useEffect(() => {
    if (!orderId) return
    let cancelled = false
    void (async () => {
      try {
        const [o, delivered] = await Promise.all([
          fetchJson<OrderLoaded>(`/api/v1/sales/orders/${orderId}`),
          fetchJson<{ delivered: Record<string, string> }>(`/api/v1/inventory/delivery-notes/delivered-qty?order_id=${orderId}`),
        ])
        if (cancelled) return
        setOrder(o)
        if (o.branch_id) setBranchId(o.branch_id)
        if (o.contact_id) {
          setContactId(o.contact_id)
          if (o.contact) {
            setContactInitialOpts([{ value: o.contact.id, label: o.contact.legal_name, sublabel: o.contact.trade_name ?? undefined }])
          }
        }
        const deliveredMap = delivered.delivered ?? {}
        setItems(
          (o.items ?? []).map(i => {
            const pending = parseFloat(i.quantity) - parseFloat(deliveredMap[i.id] ?? '0')
            return {
              order_item_id: i.id,
              product_id:    i.product_id,
              variant_id:    i.variant_id,
              description:   i.description,
              quantity:      String(Math.max(0, pending)),
            }
          }),
        )
      } catch {
        if (!cancelled) setServerError('Error al cargar el pedido de venta')
      }
    })()
    return () => { cancelled = true }
  }, [orderId])

  function updateItem(idx: number, qty: string) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: qty } : it))
  }

  async function handleSave() {
    if (!branchId) { setServerError('Elegí una sucursal.'); return }
    const lineItems = items.filter(i => parseFloat(i.quantity) > 0)
    if (lineItems.length === 0) { setServerError('Agregá al menos un ítem con cantidad mayor a cero.'); return }

    setSaving(true)
    setServerError(null)

    const body = {
      order_id:      orderId ?? null,
      branch_id:     branchId,
      contact_id:    contactId,
      warehouse_id:  warehouseId,
      delivery_date: deliveryDate ? deliveryDate.toISOString() : new Date().toISOString(),
      carrier:       carrier.trim() || null,
      tracking_code: trackingCode.trim() || null,
      notes:         notes.trim() || null,
      items: lineItems.map(i => ({
        order_item_id: i.order_item_id,
        product_id:    i.product_id,
        variant_id:    i.variant_id,
        description:   i.description,
        quantity:      parseFloat(i.quantity),
      })),
    }

    try {
      const note = await fetchJson<{ id: string }>('/api/v1/inventory/delivery-notes', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      router.push(`/inventario/remitos/${note.id}`)
    } catch (e) {
      setServerError(getApiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Remitos', href: '/inventario/remitos' },
          { label: 'Nuevo remito' },
        ]}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando…' : 'Crear remito'}
            </Button>
          </div>
        }
      />
      <InventarioSubNav />

      <div className="flex-1 p-5 overflow-auto">
        <div className="max-w-4xl mx-auto flex flex-col gap-5">

          {serverError && (
            <div className="px-4 py-2 bg-danger-bg border border-danger rounded-sm text-sm text-danger">
              {serverError}
            </div>
          )}

          {order && (
            <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-sm text-sm text-blue-700">
              Remito vinculado al pedido <strong>{order.order_number}</strong>. Las cantidades se precargan con lo pendiente de entregar.
            </div>
          )}

          <div className="bg-surface border border-border rounded-sm p-5 flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Sucursal" required>
                <BranchSelectField value={branchId} onChange={setBranchId} />
              </FormField>

              <FormField label="Depósito de salida">
                <SearchableSelect
                  value={warehouseId}
                  onChange={setWarehouseId}
                  onSearch={searchWarehouses}
                  placeholder="Buscar depósito…"
                />
              </FormField>

              <FormField label="Cliente">
                <SearchableSelect
                  value={contactId}
                  onChange={setContactId}
                  options={contactInitialOpts}
                  onSearch={searchCustomers}
                  placeholder="Buscar cliente…"
                />
              </FormField>

              <FormField label="Fecha de entrega">
                <DatePicker value={deliveryDate} onChange={setDeliveryDate} />
              </FormField>

              <FormField label="Transportista">
                <Input value={carrier} onChange={e => setCarrier(e.target.value)} placeholder="Nombre del transportista…" />
              </FormField>

              <FormField label="Código de seguimiento">
                <Input value={trackingCode} onChange={e => setTrackingCode(e.target.value)} placeholder="Tracking…" />
              </FormField>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide">Ítems a entregar</p>
            </div>
            {items.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="bg-surface-muted border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Descripción</th>
                    <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Cantidad a entregar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2.5 text-fg">{item.description}</td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={item.quantity}
                          onChange={e => updateItem(idx, e.target.value)}
                          className="w-28 h-8 px-2 text-sm text-right border border-border rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500 tabular-nums ml-auto block"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="px-5 py-4 text-[13px] text-fg-subtle">Sin ítems. Creá el remito desde un pedido de venta para precargar las líneas.</p>
            )}
          </div>

          <div className="bg-surface border border-border rounded-sm p-5">
            <FormField label="Notas">
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Observaciones del remito…" />
            </FormField>
          </div>

        </div>
      </div>
    </div>
  )
}
