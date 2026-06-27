'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, type Column } from '@/components/erp'
import { StatusBadge } from '@/components/primitives/Badge'
import { Skeleton } from '@/components/primitives/Skeleton'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { fetchJson } from '@/lib/fetch-json'
import type { BillingInvoiceStatus } from '@/types'

interface InvoiceItem {
  id: string
  description: string
  quantity: string
  unit_price: string
  total: string
}

interface InvoicePayment {
  id: string
  payment_number: string
  payment_date: string
  amount: string
  payment_method: string
}

interface Invoice {
  id: string
  invoice_number: string
  status: BillingInvoiceStatus
  period_start: string | null
  period_end: string | null
  issue_date: string | null
  due_date: string | null
  subtotal: string
  tax_amount: string
  total: string
  paid_amount: string
  balance: string
  items?: InvoiceItem[]
  payments?: InvoicePayment[]
}

const INVOICE_STATUS_LABELS: Record<BillingInvoiceStatus, string> = {
  draft: 'Borrador',
  issued: 'Emitida',
  partially_paid: 'Pago parcial',
  paid: 'Pagada',
  void: 'Anulada',
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo', transfer: 'Transferencia', check: 'Cheque', card: 'Tarjeta', other: 'Otro',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!cancelled) setLoading(true)
      try {
        const inv = await fetchJson<Invoice>(`/api/v1/billing/invoices/${invoiceId}`)
        if (cancelled) return
        setInvoice(inv)
      } catch {
        if (!cancelled) { setInvoice(null); setNotFound(true) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [invoiceId])

  const itemColumns: Column<InvoiceItem>[] = [
    { key: 'description', header: 'Descripción', mobileRole: 'title', render: r => <span className="text-fg">{r.description}</span> },
    { key: 'quantity', header: 'Cantidad', align: 'right', mobileRole: 'subtitle', render: r => <span className="tabular-nums">{r.quantity}</span> },
    { key: 'unit_price', header: 'Precio unit.', align: 'right', mobileRole: 'subtitle', render: r => <span className="tabular-nums">{formatARS(r.unit_price)}</span> },
    { key: 'total', header: 'Total', align: 'right', mobileRole: 'amount', render: r => <span className="tabular-nums">{formatARS(r.total)}</span> },
  ]

  const paymentColumns: Column<InvoicePayment>[] = [
    { key: 'payment_number', header: 'Número', mobileRole: 'title', render: r => <span className="font-mono text-[12px] text-fg">{r.payment_number}</span> },
    { key: 'payment_date', header: 'Fecha', mobileRole: 'subtitle', render: r => <span className="text-fg-muted tabular-nums">{formatDate(r.payment_date)}</span> },
    { key: 'payment_method', header: 'Medio', mobileRole: 'subtitle', render: r => <span className="text-fg-muted">{METHOD_LABELS[r.payment_method] ?? r.payment_method}</span> },
    { key: 'amount', header: 'Importe', align: 'right', mobileRole: 'amount', render: r => <span className="tabular-nums">{formatARS(r.amount)}</span> },
  ]

  return (
    <div className="flex flex-col h-full">
      <TopBar breadcrumbs={[{ label: 'Facturación', href: '/facturacion' }, { label: invoice?.invoice_number ?? 'Factura' }]} />

      <PageBody>
        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton shape="block" className="h-24 w-full" />
            <Skeleton shape="block" className="h-32 w-full" />
          </div>
        ) : notFound || !invoice ? (
          <p className="text-[13px] text-fg-muted">No se encontró la factura.</p>
        ) : (
          <>
            <dl className="rounded-md border border-border bg-surface px-4 py-3 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
              <div>
                <dt className="text-[12px] text-fg-muted">Número</dt>
                <dd className="text-[14px] font-mono font-medium text-fg">{invoice.invoice_number}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-fg-muted">Estado</dt>
                <dd className="mt-0.5"><StatusBadge value={INVOICE_STATUS_LABELS[invoice.status]} /></dd>
              </div>
              <div>
                <dt className="text-[12px] text-fg-muted">Emisión</dt>
                <dd className="text-[14px] font-medium text-fg tabular-nums">{formatDate(invoice.issue_date)}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-fg-muted">Vencimiento</dt>
                <dd className="text-[14px] font-medium text-fg tabular-nums">{formatDate(invoice.due_date)}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-fg-muted">Período</dt>
                <dd className="text-[14px] font-medium text-fg tabular-nums">
                  {invoice.period_start ? `${formatDate(invoice.period_start)} – ${formatDate(invoice.period_end)}` : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] text-fg-muted">Total</dt>
                <dd className="text-[14px] font-semibold text-fg tabular-nums">{formatARS(invoice.total)}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-fg-muted">Pagado</dt>
                <dd className="text-[14px] font-medium text-fg tabular-nums">{formatARS(invoice.paid_amount)}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-fg-muted">Saldo</dt>
                <dd className="text-[14px] font-semibold text-fg tabular-nums">{formatARS(invoice.balance)}</dd>
              </div>
            </dl>

            <section className="mb-4">
              <h2 className="text-[13px] font-semibold text-fg mb-2">Detalle</h2>
              <DataTable
                columns={itemColumns}
                data={invoice.items ?? []}
                keyExtractor={r => r.id}
                emptyMessage="Sin líneas."
              />
              <div className="mt-2 flex flex-col items-end gap-0.5 text-[13px]">
                <div className="flex gap-6"><span className="text-fg-muted">Subtotal</span><span className="tabular-nums w-28 text-right">{formatARS(invoice.subtotal)}</span></div>
                <div className="flex gap-6"><span className="text-fg-muted">IVA</span><span className="tabular-nums w-28 text-right">{formatARS(invoice.tax_amount)}</span></div>
                <div className="flex gap-6 font-semibold text-fg"><span>Total</span><span className="tabular-nums w-28 text-right">{formatARS(invoice.total)}</span></div>
              </div>
            </section>

            <section>
              <h2 className="text-[13px] font-semibold text-fg mb-2">Pagos</h2>
              <DataTable
                columns={paymentColumns}
                data={invoice.payments ?? []}
                keyExtractor={r => r.id}
                emptyMessage="Sin pagos registrados."
              />
            </section>
          </>
        )}
      </PageBody>
    </div>
  )
}
