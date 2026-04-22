'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/primitives/Button'
import { StatusBadge } from '@/components/primitives/Badge'
import { TotalsFooter } from '@/components/erp/TotalsFooter'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { EmptyState } from '@/components/erp/EmptyState'
import { formatARS } from '@/components/primitives/CurrencyInput'
import type { Quote } from '../../types'
import { QUOTE_STATUS_LABEL, PAYMENT_CONDITION_LABEL } from '../../types'
import { QuoteModal } from '../QuoteModal'
import { VentasSubNav } from '../../VentasSubNav'

interface QuoteDetailProps {
  id: string
}

export function QuoteDetail({ id }: QuoteDetailProps) {
  const router = useRouter()
  const [quote, setQuote]       = useState<Quote | null>(null)
  const [loading, setLoading]   = useState(true)
  const [refresh, setRefresh]   = useState(0)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmConvert, setConfirmConvert] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await Promise.resolve()
      setLoading(true)
      const r = await fetch(`/api/v1/sales/quotes/${id}`)
      const data = await r.json() as Quote
      if (cancelled) return
      setQuote(data)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, refresh])

  async function handleConvertToOrder() {
    const res = await fetch(`/api/v1/sales/quotes/${id}/convert`, { method: 'POST' })
    setConfirmConvert(false)
    if (res.ok) {
      const order = await res.json() as { id: string }
      router.push(`/ventas/pedidos/${order.id}`)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Ventas', href: '/ventas/presupuestos' }, { label: 'Presupuestos', href: '/ventas/presupuestos' }, { label: '…' }]} />
        <VentasSubNav />
        <div className="flex-1 flex items-center justify-center text-[13px] text-zinc-400">Cargando…</div>
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

  const canConvert = quote.status === 'accepted'

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Ventas', href: '/ventas/presupuestos' },
          { label: 'Presupuestos', href: '/ventas/presupuestos' },
          { label: quote.quote_number },
        ]}
        actions={
          <div className="flex gap-2">
            {canConvert && (
              <Button size="sm" variant="secondary" onClick={() => setConfirmConvert(true)}>
                Convertir en pedido
              </Button>
            )}
            <Button size="sm" onClick={() => setEditOpen(true)}>
              Editar
            </Button>
          </div>
        }
      />
      <VentasSubNav />

      <div className="flex-1 p-5 overflow-auto">
        <div className="max-w-3xl mx-auto flex flex-col gap-5">
          {/* Header card */}
          <div className="bg-white border border-zinc-200 rounded-sm p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wide mb-1">Presupuesto</p>
                <h1 className="text-[22px] font-bold text-zinc-900 tracking-tight">{quote.quote_number}</h1>
              </div>
              <StatusBadge value={QUOTE_STATUS_LABEL[quote.status]} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px]">
              <div>
                <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Sucursal</p>
                <p className="text-zinc-800">
                  {quote.branch
                    ? `${String(quote.branch.branch_code).padStart(2, '0')} — ${quote.branch.name}`
                    : <span className="text-zinc-400">—</span>}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Cliente</p>
                <p className="text-zinc-800 font-medium">{quote.contact?.legal_name ?? <span className="text-zinc-400">—</span>}</p>
                {quote.contact?.trade_name && (
                  <p className="text-[12px] text-zinc-500">{quote.contact.trade_name}</p>
                )}
              </div>
              <div>
                <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Condición de pago</p>
                <p className="text-zinc-800">{PAYMENT_CONDITION_LABEL[quote.payment_condition]}</p>
              </div>
              <div>
                <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Válido hasta</p>
                <p className="text-zinc-800">
                  {quote.valid_until
                    ? new Date(quote.valid_until).toLocaleDateString('es-AR')
                    : <span className="text-zinc-400">—</span>
                  }
                </p>
              </div>
            </div>

            {(quote.notes || quote.internal_notes) && (
              <div className="mt-4 grid grid-cols-2 gap-4 pt-4 border-t border-zinc-100">
                {quote.notes && (
                  <div>
                    <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Notas</p>
                    <p className="text-[13px] text-zinc-600 whitespace-pre-line">{quote.notes}</p>
                  </div>
                )}
                {quote.internal_notes && (
                  <div>
                    <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-0.5">Notas internas</p>
                    <p className="text-[13px] text-zinc-600 whitespace-pre-line">{quote.internal_notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Items */}
          <div className="bg-white border border-zinc-200 rounded-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-100">
              <h2 className="text-[13px] font-semibold text-zinc-900">Ítems</h2>
            </div>
            {quote.items && quote.items.length > 0 ? (
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
                  {quote.items.map(item => (
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

          {/* Totals */}
          <TotalsFooter
            subtotal={quote.subtotal}
            discountAmount={quote.discount_amount}
            taxAmount={quote.tax_amount}
            total={quote.total}
            className="max-w-xs self-end"
          />
        </div>
      </div>

      <QuoteModal
        key={`${quote.id}-${String(editOpen)}`}
        open={editOpen}
        quote={quote}
        onClose={() => setEditOpen(false)}
        onSaved={() => { setEditOpen(false); setRefresh(r => r + 1) }}
      />

      <ConfirmDialog
        open={confirmConvert}
        onOpenChange={setConfirmConvert}
        title="Convertir en pedido"
        description={`Se creará un pedido a partir del presupuesto ${quote.quote_number}. Esta acción requiere que el presupuesto esté aceptado.`}
        confirmLabel="Convertir"
        variant="warning"
        onConfirm={handleConvertToOrder}
      />
    </div>
  )
}
