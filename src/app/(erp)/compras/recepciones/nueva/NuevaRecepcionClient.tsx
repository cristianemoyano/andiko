'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Textarea } from '@/components/primitives/Textarea'
import { Input } from '@/components/primitives/Input'
import { DateInput } from '@/components/primitives/DateInput'
import { DatePicker } from '@/components/primitives/DatePicker'
import { SearchableSelect } from '@/components/erp/SearchableSelect'
import type { SearchableSelectOption } from '@/components/erp/SearchableSelect'
import { BranchSelectField } from '@/components/erp/BranchSelectField'
import { ComprasSubNav } from '../../ComprasSubNav'
import type { PurchaseOrder } from '../../types'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

interface ReceiptItem {
  order_item_id: string | null
  variant_id: string | null
  description: string
  quantity: string
  batch_code: string
  expiry_date: Date | null
}

function toIsoDateUtc(d: Date | null): string | null {
  if (!d) return null
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export function NuevaRecepcionClient() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const actorName = session?.user?.impersonation?.name ?? session?.user?.name ?? null
  const orderId      = searchParams.get('order_id')

  const [branchId,            setBranchId]            = useState<string | null>(null)
  const [contactId,           setContactId]           = useState<string | null>(null)
  const [contactInitialOpts,  setContactInitialOpts]  = useState<SearchableSelectOption[]>([])
  const [warehouseId,         setWarehouseId]         = useState<string | null>(null)
  const [receiptDate,         setReceiptDate]         = useState<Date | null>(new Date())
  const [notes,               setNotes]               = useState('')
  const [items,               setItems]               = useState<ReceiptItem[]>([])
  const [order,               setOrder]               = useState<PurchaseOrder | null>(null)
  const [saving,              setSaving]              = useState(false)
  const [serverError,         setServerError]         = useState<string | null>(null)

  const searchSuppliers = useCallback(async (q: string): Promise<SearchableSelectOption[]> => {
    try {
      const data = await fetchJson<{ data: Array<{ id: string; legal_name: string; trade_name: string | null }> }>(
        `/api/v1/contacts?search=${encodeURIComponent(q)}&limit=20&type=supplier`,
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
        const o = await fetchJson<PurchaseOrder>(`/api/v1/purchases/orders/${orderId}`)
        if (cancelled) return
        setOrder(o)
        if (o.branch_id) setBranchId(o.branch_id)
        if (o.contact_id) {
          setContactId(o.contact_id)
          if (o.contact) {
            setContactInitialOpts([{ value: o.contact.id, label: o.contact.legal_name, sublabel: o.contact.trade_name ?? undefined }])
          }
        }
        setItems(
          (o.items ?? []).map(i => ({
            order_item_id: i.id,
            variant_id:    i.variant_id,
            description:   i.description,
            quantity:      String(parseFloat(i.quantity) - parseFloat(i.received_qty ?? '0')),
            batch_code:    '',
            expiry_date:   null,
          })),
        )
      } catch {
        if (!cancelled) setServerError('Error al cargar la orden de compra')
      }
    })()
    return () => { cancelled = true }
  }, [orderId])

  function updateItem(idx: number, patch: Partial<ReceiptItem>) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }

  async function handleSave() {
    if (!branchId) { setServerError('Elegí una sucursal.'); return }
    if (!warehouseId) { setServerError('Elegí un depósito.'); return }

    setSaving(true)
    setServerError(null)

    const body = {
      order_id:     orderId ?? null,
      branch_id:    branchId,
      contact_id:   contactId,
      warehouse_id: warehouseId,
      receipt_date: receiptDate ? receiptDate.toISOString() : new Date().toISOString(),
      notes:        notes.trim() || null,
      items: items
        .filter(i => parseFloat(i.quantity) > 0)
        .map(i => ({
          order_item_id: i.order_item_id,
          variant_id:    i.variant_id,
          description:   i.description,
          quantity:      parseFloat(i.quantity),
          unit_cost:     0,
          batch_code:    i.batch_code.trim() || null,
          expiry_date:   toIsoDateUtc(i.expiry_date),
        })),
    }

    try {
      const receipt = await fetchJson<{ id: string }>('/api/v1/purchases/receipts', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      router.push(`/compras/recepciones/${receipt.id}`)
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
          { label: 'Recepciones', href: '/compras/recepciones' },
          { label: 'Nueva recepción' },
        ]}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando…' : 'Crear recepción'}
            </Button>
          </div>
        }
      />
      <ComprasSubNav />

      <div className="flex-1 p-5 overflow-auto">
        <div className="max-w-4xl mx-auto flex flex-col gap-5">

          {serverError && (
            <div className="px-4 py-2 bg-danger-bg border border-danger rounded-sm text-sm text-danger">
              {serverError}
            </div>
          )}

          {order && (
            <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-sm text-sm text-blue-700">
              Recepción vinculada a la orden <strong>{order.order_number}</strong>
            </div>
          )}

          {/* Header fields card */}
          <div className="bg-surface border border-border rounded-sm p-5 flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Sucursal" required>
                <BranchSelectField value={branchId} onChange={setBranchId} />
              </FormField>

              <FormField label="Depósito de destino" required>
                <SearchableSelect
                  value={warehouseId}
                  onChange={setWarehouseId}
                  onSearch={searchWarehouses}
                  placeholder="Buscar depósito…"
                />
              </FormField>

              <FormField label="Proveedor">
                <SearchableSelect
                  value={contactId}
                  onChange={setContactId}
                  options={contactInitialOpts}
                  onSearch={searchSuppliers}
                  placeholder="Buscar proveedor…"
                />
              </FormField>

              <FormField label="Fecha de recepción">
                <DatePicker value={receiptDate} onChange={setReceiptDate} />
              </FormField>
              {actorName && (
                <FormField label="Comprador">
                  <p className="text-[13px] text-fg-muted py-1.5 px-3 bg-surface-muted border border-border rounded-sm">{actorName}</p>
                </FormField>
              )}
            </div>
          </div>

          {/* Items card */}
          <div className="bg-surface border border-border rounded-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide">Ítems a recibir</p>
            </div>
            {items.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="bg-surface-muted border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Descripción</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Lote (opcional)</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Vencimiento</th>
                    <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Cantidad a recibir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2.5 text-fg">{item.description}</td>
                      <td className="px-4 py-2.5">
                        <Input
                          value={item.batch_code}
                          onChange={e => updateItem(idx, { batch_code: e.target.value })}
                          placeholder="Sin lote"
                          className="w-32"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="w-32">
                          <DateInput
                            value={item.expiry_date}
                            onChange={d => updateItem(idx, { expiry_date: d })}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={item.quantity}
                          onChange={e => updateItem(idx, { quantity: e.target.value })}
                          className="w-28 h-8 px-2 text-sm text-right border border-border rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500 tabular-nums ml-auto block"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="px-5 py-4 text-[13px] text-fg-subtle">Sin ítems. La recepción se creará sin ítems vinculados a una orden.</p>
            )}
          </div>

          {/* Notes card */}
          <div className="bg-surface border border-border rounded-sm p-5">
            <FormField label="Notas">
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Observaciones de la recepción…" />
            </FormField>
          </div>

        </div>
      </div>
    </div>
  )
}
