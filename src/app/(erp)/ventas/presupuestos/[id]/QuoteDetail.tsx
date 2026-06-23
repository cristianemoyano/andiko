'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { Button } from '@/components/primitives/Button'
import { SendDocumentEmail } from '@/components/erp/SendDocumentEmail'
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
import type { Quote, PaymentCondition } from '../../types'
import { ORDER_STATUS_LABEL, PAYMENT_CONDITION_LABEL } from '../../types'
import { VentasSubNav } from '../../VentasSubNav'
import { CustomerQuickCreateDialog } from '../../CustomerQuickCreateDialog'
import { cn } from '@/lib/utils'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifyApiError } from '@/lib/notify'
import { fieldErrorsFromApiError } from '@/lib/validation-errors'

const PAYMENT_CONDITIONS = Object.entries(PAYMENT_CONDITION_LABEL).map(([value, label]) => ({
  value: value as PaymentCondition,
  label,
}))

type QuoteStatus = Quote['status']
type FieldErrors = Record<string, string[]>

const STATUS_TRANSITIONS: Partial<Record<QuoteStatus, { next: QuoteStatus; label: string; variant?: 'secondary' | 'ghost' }[]>> = {
  draft: [
    { next: 'sent',     label: 'Marcar enviado', variant: 'secondary' },
    { next: 'expired',  label: 'Vencer',         variant: 'ghost' },
  ],
  sent: [
    { next: 'accepted', label: 'Aceptar',   variant: 'secondary' },
    { next: 'rejected', label: 'Rechazar',  variant: 'ghost' },
    { next: 'expired',  label: 'Vencer',    variant: 'ghost' },
  ],
}

function itemsToLineInput(items: Quote['items']): LineItemInput[] {
  if (!items || items.length === 0) return [makeEmptyLine()]
  return items.map((item, idx) => ({
    id:           item.id ?? String(idx),
    product_id:   item.product_id ?? null,
    variant_id:   item.variant_id ?? null,
    description:  item.description,
    quantity:     item.quantity,
    unit_price:   item.unit_price,
    discount_pct: item.discount_pct,
    iva_rate:     item.iva_rate,
  }))
}

interface QuoteDetailProps {
  id: string
}

export function QuoteDetail({ id }: QuoteDetailProps) {
  const router = useRouter()
  const [quote, setQuote]     = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [relatedOrders, setRelatedOrders] = useState<Array<{
    id: string
    order_number: string
    status: keyof typeof ORDER_STATUS_LABEL
    created_at: string
  }>>([])
  const [loadingTraceability, setLoadingTraceability] = useState(false)

  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [errors, setErrors]     = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [createContactOpen, setCreateContactOpen] = useState(false)
  const [createContactSeed, setCreateContactSeed] = useState('')

  // Edit form fields
  const [contactId, setContactId]               = useState<string | null>(null)
  const [contactOption, setContactOption]       = useState<SearchableSelectOption | null>(null)
  const [branchId, setBranchId]                 = useState<string | null>(null)
  const [priceListId, setPriceListId]           = useState<string | null>(null)
  const [validUntil, setValidUntil]             = useState<Date | null>(null)
  const [paymentCondition, setPaymentCondition] = useState<PaymentCondition>('cash')
  const [items, setItems]                       = useState<LineItemInput[]>([makeEmptyLine()])
  const [notes, setNotes]                       = useState('')
  const [internalNotes, setInternalNotes]       = useState('')

  // Confirm dialogs
  const [confirmConvert, setConfirmConvert] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [transitioning, setTransitioning]   = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const data = await fetchJson<Quote>(`/api/v1/sales/quotes/${id}`)
        if (!cancelled) setQuote(data)
      } catch {
        if (!cancelled) setQuote(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id, refresh])

  useEffect(() => {
    let cancelled = false
    async function loadRelatedOrders() {
      setLoadingTraceability(true)
      const params = new URLSearchParams({
        quote_id: id,
        page: '1',
        limit: '50',
      })
      try {
        const payload = await fetchJson<{
          data?: Array<{ id: string; order_number: string; status: keyof typeof ORDER_STATUS_LABEL; created_at: string }>
        }>(`/api/v1/sales/orders?${params}`)
        if (cancelled) return
        setRelatedOrders(Array.isArray(payload.data) ? payload.data : [])
      } catch {
        if (!cancelled) setRelatedOrders([])
      } finally {
        if (!cancelled) setLoadingTraceability(false)
      }
    }

    void loadRelatedOrders()
    return () => { cancelled = true }
  }, [id, refresh])

  function enterEditMode(q: Quote) {
    setContactId(q.contact_id ?? null)
    if (q.contact_id && q.contact) {
      setContactOption({
        value: q.contact_id,
        label: q.contact.legal_name,
        sublabel: q.contact.trade_name ?? undefined,
      })
    } else {
      setContactOption(null)
    }
    setBranchId(q.branch_id ?? null)
    setPriceListId(q.price_list_id ?? null)
    setValidUntil(q.valid_until ? new Date(q.valid_until) : null)
    setPaymentCondition(q.payment_condition)
    setItems(itemsToLineInput(q.items))
    setNotes(q.notes ?? '')
    setInternalNotes(q.internal_notes ?? '')
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
    if (!quote) return
    setSaving(true)
    setErrors({})
    setServerError(null)

    if (!contactId) {
      setSaving(false)
      setErrors(prev => ({ ...prev, contact_id: ['Seleccioná un cliente.'] }))
      return
    }

    const lineWithoutProduct = items.findIndex(item => !item.product_id)
    if (lineWithoutProduct >= 0) {
      setSaving(false)
      setServerError(`Completá el producto en la línea ${lineWithoutProduct + 1} antes de guardar.`)
      return
    }

    const body = {
      contact_id:        contactId,
      branch_id:         branchId,
      price_list_id:     priceListId,
      valid_until:       validUntil ? validUntil.toISOString() : null,
      payment_condition: paymentCondition,
      notes:             notes.trim() || null,
      internal_notes:    internalNotes.trim() || null,
      items: items.map((item, idx) => ({
        product_id:   item.product_id ?? null,
        variant_id:   item.variant_id ?? null,
        description:  item.description,
        quantity:     parseFloat(item.quantity) || 0,
        unit_price:   parseFloat(item.unit_price) || 0,
        discount_pct: parseFloat(item.discount_pct) || 0,
        iva_rate:     item.iva_rate,
        sort_order:   idx,
      })),
    }

    try {
      await fetchJson(`/api/v1/sales/quotes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      setEditMode(false)
      setRefresh(r => r + 1)
    } catch (err) {
      const fe = fieldErrorsFromApiError(err)
      if (fe) {
        setErrors(fe)
        const hasItemsErrors = Object.keys(fe).some(k => k.startsWith('items'))
        if (hasItemsErrors) {
          setServerError('Hay errores en los ítems. Revisá producto, descripción, cantidad y precio.')
        }
      } else {
        setServerError(getApiErrorMessage(err))
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleTransition(nextStatus: QuoteStatus) {
    setTransitioning(true)
    try {
      await fetchJson(`/api/v1/sales/quotes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      })
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    } finally {
      setTransitioning(false)
    }
  }

  async function handleConvertToOrder() {
    setConfirmConvert(false)
    try {
      const order = await fetchJson<{ id: string }>(`/api/v1/sales/quotes/${id}/convert`, { method: 'POST' })
      router.push(`/ventas/pedidos/${order.id}`)
    } catch (e) {
      notifyApiError(e)
    }
  }

  async function handleCancelQuote() {
    setConfirmCancel(false)
    try {
      await fetchJson(`/api/v1/sales/quotes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' satisfies QuoteStatus }),
      })
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    }
  }

  const searchContacts = useCallback(async (q: string): Promise<SearchableSelectOption[]> => {
    try {
      const data = await fetchJson<{ data: Array<{ id: string; legal_name: string; trade_name: string | null }> }>(
        `/api/v1/contacts?search=${encodeURIComponent(q)}&limit=20&type=customer`,
      )
      return (data.data ?? []).map(c => ({ value: c.id, label: c.legal_name, sublabel: c.trade_name ?? undefined }))
    } catch {
      return []
    }
  }, [])

  const searchPriceLists = useCallback(async (q: string): Promise<SearchableSelectOption[]> => {
    try {
      const data = await fetchJson<{ data: Array<{ id: string; name: string }> }>(
        `/api/v1/catalog/price-lists?search=${encodeURIComponent(q)}&limit=20`,
      )
      return (data.data ?? []).map(pl => ({ value: pl.id, label: pl.name }))
    } catch {
      return []
    }
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Ventas', href: '/ventas/presupuestos' }, { label: 'Presupuestos', href: '/ventas/presupuestos' }, { label: '…' }]} />
        <VentasSubNav />
        <div className="flex-1 flex items-center justify-center text-[13px] text-fg-subtle">Cargando…</div>
      </div>
    )
  }

  if (!quote) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Ventas', href: '/ventas/presupuestos' }, { label: 'Presupuestos', href: '/ventas/presupuestos' }, { label: 'No encontrado' }]} />
        <VentasSubNav />
        <div className="flex-1 flex items-center justify-center">
          <EmptyState title="Presupuesto no encontrado" description="El presupuesto no existe o fue eliminado." />
        </div>
      </div>
    )
  }

  const transitions = STATUS_TRANSITIONS[quote.status] ?? []
  const canConvert  = quote.status === 'accepted'
  const canCancel = quote.status === 'draft'
  const canEdit     = quote.status === 'draft' || quote.status === 'sent'

  const editTotals = editMode ? calcTotals(items) : null

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Ventas', href: '/ventas/presupuestos' },
          { label: 'Presupuestos', href: '/ventas/presupuestos' },
          { label: quote.quote_number },
        ]}
        actions={
          <div className="flex flex-wrap gap-2 justify-end">
            <Button asChild size="sm" variant="ghost">
              <Link href={`/ventas/presupuestos/${id}/print`} target="_blank" rel="noopener noreferrer">
                Imprimir
              </Link>
            </Button>
            <SendDocumentEmail
              documentType="quote"
              documentId={id}
              documentLabel={`Presupuesto ${quote.quote_number}`}
            />
            {!editMode && (
              <>
                {transitions.map(t => (
                  <Button key={t.next} size="sm" variant={t.variant ?? 'secondary'} onClick={() => handleTransition(t.next)} disabled={transitioning}>
                    {t.label}
                  </Button>
                ))}
                {canConvert && (
                  <Button size="sm" onClick={() => setConfirmConvert(true)} disabled={transitioning}>
                    Convertir en pedido
                  </Button>
                )}
                {canCancel && (
                  <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(true)} disabled={transitioning}>
                    Cancelar
                  </Button>
                )}
                {canEdit && (
                  <Button size="sm" variant="secondary" onClick={() => enterEditMode(quote)}>
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

      <PageBody>
        <div className="max-w-4xl mx-auto flex flex-col gap-5">

          {/* Status pipeline */}
          <div className="bg-surface border border-border rounded-sm px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide mb-1">Presupuesto</p>
              <h1 className="text-[20px] font-bold text-fg tracking-tight">{quote.quote_number}</h1>
            </div>
            <StatusPipeline type="quote" status={quote.status} />
          </div>

          {/* Header info card */}
          <div className="bg-surface border border-border rounded-sm p-5 flex flex-col gap-4">
            {editMode ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Cliente" htmlFor="contact_id" error={errors.contact_id?.[0]}>
                    <SearchableSelect
                      id="contact_id"
                      value={contactId}
                      onChange={(next) => {
                        setContactId(next)
                        if (!next) setContactOption(null)
                      }}
                      onSelect={setContactOption}
                      onSearch={searchContacts}
                      options={contactOption ? [contactOption] : []}
                      onCreateRequest={(query) => {
                        setCreateContactSeed(query)
                        setCreateContactOpen(true)
                      }}
                      createActionLabel="Crear cliente…"
                      placeholder="Buscar cliente…"
                      error={!!errors.contact_id}
                    />
                  </FormField>
                  <FormField label="Válido hasta" htmlFor="valid_until">
                    <DatePicker id="valid_until" value={validUntil} onChange={setValidUntil} placeholder="Seleccionar fecha" />
                  </FormField>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                            : 'border-border-strong text-fg-muted hover:border-border-strong'
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
                  <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Sucursal</p>
                  <p className="text-fg">
                    {quote.branch
                      ? `${String(quote.branch.branch_code).padStart(2, '0')} — ${quote.branch.name}`
                      : <span className="text-fg-subtle">—</span>}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Cliente</p>
                  <p className="text-fg font-medium">{quote.contact?.legal_name ?? <span className="text-fg-subtle">—</span>}</p>
                  {quote.contact?.trade_name && (
                    <p className="text-[12px] text-fg-muted">{quote.contact.trade_name}</p>
                  )}
                </div>
                <div>
                  <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Condición de pago</p>
                  <p className="text-fg">{PAYMENT_CONDITION_LABEL[quote.payment_condition]}</p>
                </div>
                <div>
                  <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Válido hasta</p>
                  <p className="text-fg">
                    {quote.valid_until
                      ? new Date(quote.valid_until).toLocaleDateString('es-AR')
                      : <span className="text-fg-subtle">—</span>
                    }
                  </p>
                </div>
                {quote.salesperson && (
                  <div>
                    <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Vendedor</p>
                    <p className="text-fg">{quote.salesperson.name}</p>
                  </div>
                )}
              </div>
            )}

            {editMode ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
                <FormField label="Notas para el cliente" htmlFor="notes">
                  <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Condiciones, aclaraciones…" />
                </FormField>
                <FormField label="Notas internas" htmlFor="internal_notes">
                  <Textarea id="internal_notes" value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={3} placeholder="Visible solo para el equipo…" />
                </FormField>
              </div>
            ) : (
              (quote.notes || quote.internal_notes) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
                  {quote.notes && (
                    <div>
                      <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Notas</p>
                      <p className="text-[13px] text-fg-muted whitespace-pre-line">{quote.notes}</p>
                    </div>
                  )}
                  {quote.internal_notes && (
                    <div>
                      <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide mb-0.5">Notas internas</p>
                      <p className="text-[13px] text-fg-muted whitespace-pre-line">{quote.internal_notes}</p>
                    </div>
                  )}
                </div>
              )
            )}

            {serverError && (
              <p role="alert" className="text-[12px] text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">
                {serverError}
              </p>
            )}
          </div>

          <div className="bg-surface border border-border rounded-sm p-5">
            <h2 className="text-[13px] font-semibold text-fg mb-3">Trazabilidad</h2>
            {loadingTraceability ? (
              <p className="text-[13px] text-fg-muted">Cargando relaciones…</p>
            ) : relatedOrders.length === 0 ? (
              <p className="text-[13px] text-fg-muted">Todavía no se generaron pedidos desde este presupuesto.</p>
            ) : (
              <div className="space-y-2">
                {relatedOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between gap-3 rounded-sm border border-border px-3 py-2">
                    <div>
                      <p className="text-[13px] font-medium text-fg">{order.order_number}</p>
                      <p className="text-[12px] text-fg-muted">
                        {ORDER_STATUS_LABEL[order.status] ?? order.status} · {new Date(order.created_at).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                    <Button variant="ghost" size="xs" asChild>
                      <Link href={`/ventas/pedidos/${order.id}`}>Ver pedido</Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Items */}
          {editMode ? (
            <div className="bg-surface border border-border rounded-sm p-5">
              <SalesLineItemsEditor items={items} onChange={setItems} priceListId={priceListId} />
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <h2 className="text-[13px] font-semibold text-fg">Ítems</h2>
              </div>
              {quote.items && quote.items.length > 0 ? (
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-surface-muted border-b border-border">
                      <th className="px-4 py-2 text-left font-medium text-fg-muted">Descripción</th>
                      <th className="px-4 py-2 text-right font-medium text-fg-muted">Cant.</th>
                      <th className="px-4 py-2 text-right font-medium text-fg-muted">P. unitario</th>
                      <th className="px-4 py-2 text-right font-medium text-fg-muted">Desc.</th>
                      <th className="px-4 py-2 text-right font-medium text-fg-muted">IVA</th>
                      <th className="px-4 py-2 text-right font-medium text-fg-muted">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.items.map(item => (
                      <tr key={item.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5 text-fg">{item.description}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">{item.quantity}</td>
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
              ) : (
                <div className="px-4 py-8 text-center text-[13px] text-fg-subtle">Sin ítems</div>
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
              subtotal={quote.subtotal}
              discountAmount={quote.discount_amount}
              taxAmount={quote.tax_amount}
              total={quote.total}
              className="max-w-xs self-end"
            />
          )}
        </div>
      </PageBody>

      <ConfirmDialog
        open={confirmConvert}
        onOpenChange={setConfirmConvert}
        title="Convertir en pedido"
        description={`Se creará un pedido a partir del presupuesto ${quote.quote_number}.`}
        confirmLabel="Convertir"
        variant="warning"
        onConfirm={handleConvertToOrder}
      />

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancelar presupuesto"
        description={`El presupuesto ${quote.quote_number} quedará cancelado y no podrá editarse.`}
        confirmLabel="Cancelar presupuesto"
        variant="danger"
        onConfirm={handleCancelQuote}
      />

      <CustomerQuickCreateDialog
        open={createContactOpen}
        onOpenChange={setCreateContactOpen}
        initialLegalName={createContactSeed}
        onCreated={(option) => {
          setContactOption(option)
          setContactId(option.value)
        }}
      />
    </div>
  )
}
