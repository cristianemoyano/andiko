'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Textarea } from '@/components/primitives/Textarea'
import { DatePicker } from '@/components/primitives/DatePicker'
import { TotalsFooter } from '@/components/erp/TotalsFooter'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { EmptyState } from '@/components/erp/EmptyState'
import { StatusPipeline } from '@/components/erp/StatusPipeline'
import { SalesLineItemsEditor, calcTotals, makeEmptyLine } from '@/components/erp/SalesLineItemsEditor'
import type { LineItemInput } from '@/components/erp/SalesLineItemsEditor'
import { SearchableSelect } from '@/components/erp/SearchableSelect'
import type { SearchableSelectOption } from '@/components/erp/SearchableSelect'
import { VentasBranchField } from '@/components/erp/VentasBranchField'
import { formatARS } from '@/components/primitives/CurrencyInput'
import type { Order, PaymentCondition } from '../../types'
import { PAYMENT_CONDITION_LABEL } from '../../types'
import { VentasSubNav } from '../../VentasSubNav'
import { cn, parseResponseBodyJson } from '@/lib/utils'

const PAYMENT_CONDITIONS = Object.entries(PAYMENT_CONDITION_LABEL).map(([value, label]) => ({
  value: value as PaymentCondition,
  label,
}))

type OrderStatus = Order['status']
type FieldErrors = Record<string, string[]>

const STATUS_TRANSITIONS: Partial<Record<OrderStatus, { next: OrderStatus; label: string }[]>> = {
  draft:       [{ next: 'confirmed',   label: 'Confirmar pedido' }],
  confirmed:   [{ next: 'in_progress', label: 'Iniciar proceso' }],
  in_progress: [{ next: 'delivered',   label: 'Marcar entregado' }],
}
const CAN_CANCEL: OrderStatus[] = ['draft', 'confirmed', 'in_progress']

function itemsToLineInput(items: Order['items']): LineItemInput[] {
  if (!items || items.length === 0) return [makeEmptyLine()]
  return items.map((item, idx) => ({
    id:           item.id ?? String(idx),
    product_id:   item.product_id ?? null,
    description:  item.description,
    quantity:     item.quantity,
    unit_price:   item.unit_price,
    discount_pct: item.discount_pct,
    iva_rate:     item.iva_rate,
  }))
}

interface OrderDetailProps {
  id: string
}

export function OrderDetail({ id }: OrderDetailProps) {
  const router = useRouter()
  const [order, setOrder]     = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)

  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [errors, setErrors]     = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)

  // Edit form fields
  const [contactId, setContactId]               = useState<string | null>(null)
  const [branchId, setBranchId]                 = useState<string | null>(null)
  const [priceListId, setPriceListId]           = useState<string | null>(null)
  const [requiredDate, setRequiredDate]         = useState<Date | null>(null)
  const [paymentCondition, setPaymentCondition] = useState<PaymentCondition>('cash')
  const [items, setItems]                       = useState<LineItemInput[]>([makeEmptyLine()])
  const [notes, setNotes]                       = useState('')
  const [internalNotes, setInternalNotes]       = useState('')

  // Confirm dialogs
  const [confirmConvert, setConfirmConvert]   = useState(false)
  const [confirmCancel, setConfirmCancel]     = useState(false)
  const [transitioning, setTransitioning]     = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await Promise.resolve()
      setLoading(true)
      const r = await fetch(`/api/v1/sales/orders/${id}`)
      const data = await r.json() as Order
      if (cancelled) return
      setOrder(data)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [id, refresh])

  function enterEditMode(o: Order) {
    setContactId(o.contact_id ?? null)
    setBranchId(o.branch_id ?? null)
    setPriceListId(o.price_list_id ?? null)
    setRequiredDate(o.required_date ? new Date(o.required_date) : null)
    setPaymentCondition(o.payment_condition)
    setItems(itemsToLineInput(o.items))
    setNotes(o.notes ?? '')
    setInternalNotes(o.internal_notes ?? '')
    setErrors({})
    setServerError(null)
    setEditMode(true)
  }

  function cancelEdit() {
    setEditMode(false)
    setErrors({})
    setServerError(null)
  }

  async function handleSave() {
    if (!order) return
    setSaving(true)
    setErrors({})
    setServerError(null)

    const body = {
      contact_id:        contactId,
      branch_id:         branchId,
      price_list_id:     priceListId,
      required_date:     requiredDate ? requiredDate.toISOString() : null,
      payment_condition: paymentCondition,
      notes:             notes.trim() || null,
      internal_notes:    internalNotes.trim() || null,
      items: items.map((item, idx) => ({
        product_id:   item.product_id ?? null,
        description:  item.description,
        quantity:     parseFloat(item.quantity) || 0,
        unit_price:   parseFloat(item.unit_price) || 0,
        discount_pct: parseFloat(item.discount_pct) || 0,
        iva_rate:     item.iva_rate,
        sort_order:   idx,
      })),
    }

    const res = await fetch(`/api/v1/sales/orders/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })

    setSaving(false)

    if (res.ok) {
      setEditMode(false)
      setRefresh(r => r + 1)
      return
    }

    const data = await parseResponseBodyJson<{ code?: string; details?: { fieldErrors?: FieldErrors }; error?: string }>(res)
    if (data?.code === 'VALIDATION_ERROR' && data.details?.fieldErrors) {
      setErrors(data.details.fieldErrors)
    } else {
      setServerError(data?.error ?? `Error ${res.status}. Revisá los datos e intentá de nuevo.`)
    }
  }

  async function handleTransition(nextStatus: OrderStatus) {
    setTransitioning(true)
    const res = await fetch(`/api/v1/sales/orders/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status: nextStatus }),
    })
    setTransitioning(false)
    if (res.ok) setRefresh(r => r + 1)
  }

  async function handleCancelOrder() {
    setTransitioning(true)
    const res = await fetch(`/api/v1/sales/orders/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status: 'cancelled' }),
    })
    setConfirmCancel(false)
    setTransitioning(false)
    if (res.ok) setRefresh(r => r + 1)
  }

  async function handleConvertToInvoice() {
    const res = await fetch(`/api/v1/sales/orders/${id}/convert`, { method: 'POST' })
    setConfirmConvert(false)
    if (res.ok) {
      const invoice = await res.json() as { id: string }
      router.push(`/ventas/facturas/${invoice.id}`)
    }
  }

  const searchContacts = useCallback(async (q: string): Promise<SearchableSelectOption[]> => {
    const res = await fetch(`/api/v1/contacts?search=${encodeURIComponent(q)}&limit=20&type=customer`)
    const data = await res.json() as { data: Array<{ id: string; legal_name: string; trade_name: string | null }> }
    return (data.data ?? []).map(c => ({ value: c.id, label: c.legal_name, sublabel: c.trade_name ?? undefined }))
  }, [])

  const searchPriceLists = useCallback(async (q: string): Promise<SearchableSelectOption[]> => {
    const res = await fetch(`/api/v1/catalog/price-lists?search=${encodeURIComponent(q)}&limit=20`)
    const data = await res.json() as { data: Array<{ id: string; name: string }> }
    return (data.data ?? []).map(pl => ({ value: pl.id, label: pl.name }))
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Ventas', href: '/ventas/presupuestos' }, { label: 'Pedidos', href: '/ventas/pedidos' }, { label: '…' }]} />
        <VentasSubNav />
        <div className="flex-1 flex items-center justify-center text-[13px] text-zinc-400">Cargando…</div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Ventas', href: '/ventas/presupuestos' }, { label: 'Pedidos', href: '/ventas/pedidos' }, { label: 'No encontrado' }]} />
        <VentasSubNav />
        <div className="flex-1 flex items-center justify-center">
          <EmptyState title="Pedido no encontrado" description="El pedido no existe o fue eliminado." />
        </div>
      </div>
    )
  }

  const transitions = STATUS_TRANSITIONS[order.status] ?? []
  const canCancel   = CAN_CANCEL.includes(order.status)
  const canConvert  = order.status === 'delivered'
  const canEdit     = order.status !== 'delivered' && order.status !== 'cancelled'

  const contactOption: SearchableSelectOption[] = order.contact && order.contact_id
    ? [{ value: order.contact_id, label: order.contact.legal_name, sublabel: order.contact.trade_name ?? undefined }]
    : []

  const editTotals = editMode ? calcTotals(items) : null

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Ventas', href: '/ventas/presupuestos' },
          { label: 'Pedidos', href: '/ventas/pedidos' },
          { label: order.order_number },
        ]}
        actions={
          <div className="flex flex-wrap gap-2 justify-end">
            {!editMode && (
              <>
                {transitions.map(t => (
                  <Button key={t.next} size="sm" variant="secondary" onClick={() => handleTransition(t.next)} disabled={transitioning}>
                    {t.label}
                  </Button>
                ))}
                {canConvert && (
                  <Button size="sm" onClick={() => setConfirmConvert(true)} disabled={transitioning}>
                    Crear factura
                  </Button>
                )}
                {canCancel && (
                  <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(true)} disabled={transitioning}>
                    Cancelar pedido
                  </Button>
                )}
                {canEdit && (
                  <Button size="sm" variant="secondary" onClick={() => enterEditMode(order)}>
                    Editar
                  </Button>
                )}
              </>
            )}
            {editMode && (
              <>
                <Button size="sm" variant="secondary" onClick={cancelEdit} disabled={saving}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </Button>
              </>
            )}
          </div>
        }
      />
      <VentasSubNav />

      <div className="flex-1 p-5 overflow-auto">
        <div className="max-w-4xl mx-auto flex flex-col gap-5">

          {/* Status pipeline */}
          <div className="bg-white border border-zinc-200 rounded-sm px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wide mb-1">Pedido</p>
              <h1 className="text-[20px] font-bold text-zinc-900 tracking-tight">{order.order_number}</h1>
            </div>
            <StatusPipeline type="order" status={order.status} />
          </div>

          {/* Header info card */}
          <div className="bg-white border border-zinc-200 rounded-sm p-5 flex flex-col gap-4">
            {editMode ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Cliente" htmlFor="contact_id" error={errors.contact_id?.[0]}>
                    <SearchableSelect
                      id="contact_id"
                      value={contactId}
                      onChange={setContactId}
                      onSearch={searchContacts}
                      options={contactOption}
                      placeholder="Buscar cliente…"
                      error={!!errors.contact_id}
                    />
                  </FormField>
                  <FormField label="Fecha requerida" htmlFor="required_date">
                    <DatePicker id="required_date" value={requiredDate} onChange={setRequiredDate} placeholder="Seleccionar fecha" />
                  </FormField>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <VentasBranchField value={branchId} onChange={setBranchId} error={errors.branch_id?.[0]} />
                  <FormField label="Lista de precios" htmlFor="price_list_id">
                    <SearchableSelect
                      id="price_list_id"
                      value={priceListId}
                      onChange={setPriceListId}
                      onSearch={searchPriceLists}
                      placeholder="Sin lista de precios"
                      clearable
                    />
                  </FormField>
                </div>
                <FormField label="Condición de pago">
                  <div className="flex gap-2 flex-wrap">
                    {PAYMENT_CONDITIONS.map(pc => (
                      <button
                        key={pc.value}
                        type="button"
                        onClick={() => setPaymentCondition(pc.value)}
                        className={cn(
                          'px-3 py-1 text-[12px] rounded-sm border transition-colors',
                          paymentCondition === pc.value
                            ? 'border-brand-600 bg-brand-50 text-brand-600 font-medium'
                            : 'border-zinc-300 text-zinc-600 hover:border-zinc-400'
                        )}
                      >
                        {pc.label}
                      </button>
                    ))}
                  </div>
                </FormField>
              </>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px]">
                <div>
                  <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Sucursal</p>
                  <p className="text-zinc-800">
                    {order.branch
                      ? `${String(order.branch.branch_code).padStart(2, '0')} — ${order.branch.name}`
                      : <span className="text-zinc-400">—</span>}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Cliente</p>
                  <p className="text-zinc-800 font-medium">{order.contact?.legal_name ?? <span className="text-zinc-400">—</span>}</p>
                  {order.contact?.trade_name && (
                    <p className="text-[12px] text-zinc-500">{order.contact.trade_name}</p>
                  )}
                </div>
                <div>
                  <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Condición de pago</p>
                  <p className="text-zinc-800">{PAYMENT_CONDITION_LABEL[order.payment_condition]}</p>
                </div>
                <div>
                  <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Fecha requerida</p>
                  <p className="text-zinc-800">
                    {order.required_date
                      ? new Date(order.required_date).toLocaleDateString('es-AR')
                      : <span className="text-zinc-400">—</span>
                    }
                  </p>
                </div>
              </div>
            )}

            {/* Notes — always visible */}
            {editMode ? (
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-100">
                <FormField label="Notas para el cliente" htmlFor="notes">
                  <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Condiciones, aclaraciones…" />
                </FormField>
                <FormField label="Notas internas" htmlFor="internal_notes">
                  <Textarea id="internal_notes" value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={3} placeholder="Visible solo para el equipo…" />
                </FormField>
              </div>
            ) : (
              (order.notes || order.internal_notes) && (
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-100">
                  {order.notes && (
                    <div>
                      <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Notas</p>
                      <p className="text-[13px] text-zinc-600 whitespace-pre-line">{order.notes}</p>
                    </div>
                  )}
                  {order.internal_notes && (
                    <div>
                      <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Notas internas</p>
                      <p className="text-[13px] text-zinc-600 whitespace-pre-line">{order.internal_notes}</p>
                    </div>
                  )}
                </div>
              )
            )}

            {serverError && (
              <p role="alert" className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2">
                {serverError}
              </p>
            )}
          </div>

          {/* Items */}
          {editMode ? (
            <div className="bg-white border border-zinc-200 rounded-sm p-5">
              <SalesLineItemsEditor items={items} onChange={setItems} priceListId={priceListId} />
            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-100">
                <h2 className="text-[13px] font-semibold text-zinc-900">Ítems</h2>
              </div>
              {order.items && order.items.length > 0 ? (
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-100">
                      <th className="px-4 py-2 text-left font-medium text-zinc-500">Descripción</th>
                      <th className="px-4 py-2 text-right font-medium text-zinc-500">Cant.</th>
                      <th className="px-4 py-2 text-right font-medium text-zinc-500">P. unitario</th>
                      <th className="px-4 py-2 text-right font-medium text-zinc-500">Desc.</th>
                      <th className="px-4 py-2 text-right font-medium text-zinc-500">IVA</th>
                      <th className="px-4 py-2 text-right font-medium text-zinc-500">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map(item => (
                      <tr key={item.id} className="border-b border-zinc-100 last:border-0">
                        <td className="px-4 py-2.5 text-zinc-800">{item.description}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-zinc-600">{item.quantity}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-zinc-600">{formatARS(item.unit_price)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">
                          {parseFloat(item.discount_pct) > 0 ? `${item.discount_pct}%` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">{item.iva_rate}%</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium text-zinc-800">{formatARS(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="px-4 py-8 text-center text-[13px] text-zinc-400">Sin ítems</div>
              )}
            </div>
          )}

          {/* Totals */}
          {editMode && editTotals ? (
            <TotalsFooter
              subtotal={String(editTotals.subtotal)}
              discountAmount={String(editTotals.discountAmount)}
              taxBreakdown={editTotals.taxBreakdown}
              taxAmount={String(editTotals.taxAmount)}
              total={String(editTotals.total)}
              className="max-w-xs self-end"
            />
          ) : (
            <TotalsFooter
              subtotal={order.subtotal}
              discountAmount={order.discount_amount}
              taxAmount={order.tax_amount}
              total={order.total}
              className="max-w-xs self-end"
            />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmConvert}
        onOpenChange={setConfirmConvert}
        title="Crear factura"
        description={`Se creará una factura a partir del pedido ${order.order_number}. El pedido debe estar entregado.`}
        confirmLabel="Crear factura"
        variant="warning"
        onConfirm={handleConvertToInvoice}
      />

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancelar pedido"
        description={`¿Cancelar el pedido ${order.order_number}? Esta acción no se puede deshacer.`}
        confirmLabel="Cancelar pedido"
        variant="danger"
        onConfirm={handleCancelOrder}
      />
    </div>
  )
}
