'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { Textarea } from '@/components/primitives/Textarea'
import { DatePicker } from '@/components/primitives/DatePicker'
import { TotalsFooter } from '@/components/erp/TotalsFooter'
import { SalesLineItemsEditor, calcTotals, makeEmptyLine } from '@/components/erp/SalesLineItemsEditor'
import Decimal from 'decimal.js'
import type { LineItemInput } from '@/components/erp/SalesLineItemsEditor'
import { SearchableSelect } from '@/components/erp/SearchableSelect'
import type { SearchableSelectOption } from '@/components/erp/SearchableSelect'
import { BranchSelectField } from '@/components/erp/BranchSelectField'
import { ComprasSubNav } from '../../ComprasSubNav'
import { PAYMENT_CONDITION_LABEL } from '../../types'
import type { PurchaseOrder, PurchaseReceipt } from '../../types'
import type { IvaRate } from '@/types'

const PAYMENT_CONDITIONS = Object.entries(PAYMENT_CONDITION_LABEL).map(([value, label]) => ({ value, label }))

export function NuevaFacturaProvClient() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const actorName = session?.user?.impersonation?.name ?? session?.user?.name ?? null
  const orderId      = searchParams.get('order_id')
  const receiptId    = searchParams.get('receipt_id')

  const [branchId,               setBranchId]               = useState<string | null>(null)
  const [contactId,              setContactId]              = useState<string | null>(null)
  const [contactOpts,            setContactOpts]            = useState<SearchableSelectOption[]>([])
  const [supplierInvoiceNumber,  setSupplierInvoiceNumber]  = useState('')
  const [invoiceDate,            setInvoiceDate]            = useState<Date | null>(new Date())
  const [paymentCondition,       setPaymentCondition]       = useState('cash')
  const [items,                  setItems]                  = useState<LineItemInput[]>([makeEmptyLine()])
  const [notes,                  setNotes]                  = useState('')
  const [saving,                 setSaving]                 = useState(false)
  const [serverError,            setServerError]            = useState<string | null>(null)
  const [linkedOrderLabel,       setLinkedOrderLabel]       = useState<string | null>(null)
  const [linkedReceiptLabel,     setLinkedReceiptLabel]     = useState<string | null>(null)

  // Pre-fill from linked purchase order
  useEffect(() => {
    if (!orderId) return
    fetch(`/api/v1/purchases/orders/${orderId}`)
      .then(r => r.json())
      .then(d => {
        const order = d as PurchaseOrder
        setLinkedOrderLabel(order.order_number)
        if (order.branch_id) setBranchId(order.branch_id)
        if (order.contact_id) {
          setContactId(order.contact_id)
          if (order.contact) {
            setContactOpts([{ value: order.contact_id, label: order.contact.legal_name, sublabel: order.contact.trade_name ?? undefined }])
          }
        }
        if (order.payment_condition) setPaymentCondition(order.payment_condition)
        if ((order.items ?? []).length > 0) {
          setItems(order.items.map(i => ({
            ...makeEmptyLine(),
            product_id:  i.product_id ?? null,
            variant_id:  i.variant_id ?? null,
            description: i.description,
            quantity:    String(parseFloat(i.quantity)),
            unit_price:  i.unit_price ?? '0',
            discount_pct: i.discount_pct ?? '0',
            iva_rate:    (i.iva_rate ?? '21') as IvaRate,
          })))
        }
      })
      .catch(() => {/* ignore pre-fill errors */})
  }, [orderId])

  // Pre-fill from linked receipt (only contact/branch — receipt items have unit_cost not unit_price)
  useEffect(() => {
    if (!receiptId) return
    fetch(`/api/v1/purchases/receipts/${receiptId}`)
      .then(r => r.json())
      .then(d => {
        const receipt = d as PurchaseReceipt
        setLinkedReceiptLabel(receipt.receipt_number)
        if (!orderId) {
          // Only override from receipt if not already pre-filled from order
          if (receipt.branch_id) setBranchId(receipt.branch_id)
          if (receipt.contact_id) {
            setContactId(receipt.contact_id)
            if (receipt.contact) {
              setContactOpts([{ value: receipt.contact_id, label: receipt.contact.legal_name, sublabel: receipt.contact.trade_name ?? undefined }])
            }
          }
          if ((receipt.items ?? []).length > 0) {
            setItems(receipt.items.map(i => ({
              ...makeEmptyLine(),
              description: i.description,
              quantity:    String(parseFloat(i.quantity)),
              unit_price:  i.unit_cost ?? '0',
              discount_pct: '0',
              iva_rate:    '21' as IvaRate,
            })))
          }
        }
      })
      .catch(() => {/* ignore pre-fill errors */})
  }, [receiptId, orderId])

  const searchSuppliers = useCallback(async (q: string): Promise<SearchableSelectOption[]> => {
    const res = await fetch(`/api/v1/contacts?search=${encodeURIComponent(q)}&limit=20&type=supplier`)
    const data = await res.json() as { data: Array<{ id: string; legal_name: string; trade_name: string | null }> }
    return (data.data ?? []).map(c => ({ value: c.id, label: c.legal_name, sublabel: c.trade_name ?? undefined }))
  }, [])

  async function handleSave() {
    if (!branchId) { setServerError('Elegí una sucursal.'); return }

    setSaving(true)
    setServerError(null)

    const body = {
      branch_id:               branchId,
      contact_id:              contactId,
      order_id:                orderId   ?? null,
      receipt_id:              receiptId ?? null,
      supplier_invoice_number: supplierInvoiceNumber.trim() || null,
      invoice_date:            invoiceDate ? invoiceDate.toISOString() : null,
      payment_condition:       paymentCondition,
      notes:                   notes.trim() || null,
      items: items.map(i => ({
        product_id:   i.product_id,
        variant_id:   i.variant_id,
        description:  i.description,
        quantity:     parseFloat(i.quantity) || 1,
        unit_price:   parseFloat(i.unit_price) || 0,
        discount_pct: parseFloat(i.discount_pct) || 0,
        iva_rate:     i.iva_rate,
      })),
    }

    try {
      const res = await fetch('/api/v1/purchases/supplier-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setServerError(d.error ?? 'Error al crear la factura')
        return
      }
      const invoice = await res.json() as { id: string }
      router.push(`/compras/facturas/${invoice.id}`)
    } catch {
      setServerError('Error de red. Intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Facturas proveedor', href: '/compras/facturas' },
          { label: 'Nueva factura' },
        ]}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => router.push('/compras/facturas')}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando…' : 'Crear factura'}
            </Button>
          </div>
        }
      />
      <ComprasSubNav />

      <div className="flex-1 p-5 overflow-auto">
        <div className="max-w-4xl mx-auto flex flex-col gap-5">

          {serverError && (
            <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-sm text-sm text-red-700">
              {serverError}
            </div>
          )}

          {/* Linked document banner */}
          {(linkedOrderLabel || linkedReceiptLabel) && (
            <div className="px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-sm text-sm text-blue-700 flex gap-3 flex-wrap">
              {linkedOrderLabel && (
                <span>
                  Vinculado a orden <span className="font-semibold">{linkedOrderLabel}</span>
                </span>
              )}
              {linkedReceiptLabel && (
                <span>
                  · Recepción <span className="font-semibold">{linkedReceiptLabel}</span>
                </span>
              )}
            </div>
          )}

          {/* Header fields card */}
          <div className="bg-white border border-zinc-200 rounded-sm p-5 flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Sucursal" required>
                <BranchSelectField value={branchId} onChange={setBranchId} />
              </FormField>

              <FormField label="Proveedor">
                <SearchableSelect
                  value={contactId}
                  onChange={setContactId}
                  onSearch={searchSuppliers}
                  options={contactOpts.length > 0 ? contactOpts : undefined}
                  placeholder="Buscar proveedor…"
                />
              </FormField>

              <FormField label="N° de factura del proveedor">
                <Input
                  value={supplierInvoiceNumber}
                  onChange={e => setSupplierInvoiceNumber(e.target.value)}
                  placeholder="Ej: 0001-00001234"
                />
              </FormField>

              <FormField label="Fecha de la factura">
                <DatePicker value={invoiceDate} onChange={setInvoiceDate} />
              </FormField>

              <FormField label="Condición de pago">
                <select
                  value={paymentCondition}
                  onChange={e => setPaymentCondition(e.target.value)}
                  className="w-full h-9 px-3 text-sm border border-zinc-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {PAYMENT_CONDITIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </FormField>
              {actorName && (
                <FormField label="Comprador">
                  <p className="text-[13px] text-zinc-700 py-1.5 px-3 bg-zinc-50 border border-zinc-200 rounded-sm">{actorName}</p>
                </FormField>
              )}
            </div>
          </div>

          {/* Items + totals card */}
          <div className="bg-white border border-zinc-200 rounded-sm overflow-hidden">
            <SalesLineItemsEditor items={items} onChange={setItems} priceListId={null} />
            <div className="border-t border-zinc-100">
              {(() => {
                const totals = calcTotals(items)
                return (
                  <TotalsFooter
                    subtotal={new Decimal(totals.subtotal).toFixed(2)}
                    taxAmount={new Decimal(totals.taxAmount).toFixed(2)}
                    total={new Decimal(totals.total).toFixed(2)}
                  />
                )
              })()}
            </div>
          </div>

          {/* Notes card */}
          <div className="bg-white border border-zinc-200 rounded-sm p-5">
            <FormField label="Notas">
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Notas internas…" />
            </FormField>
          </div>

        </div>
      </div>
    </div>
  )
}
