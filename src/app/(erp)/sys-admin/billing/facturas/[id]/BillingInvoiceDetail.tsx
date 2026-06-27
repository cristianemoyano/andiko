'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, type Column } from '@/components/erp'
import { StatusBadge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Skeleton } from '@/components/primitives/Skeleton'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { BillingInvoiceItemsBreakdown } from '@/components/erp/billing/BillingInvoiceItemsBreakdown'
import { RecordPaymentModal } from '../../RecordPaymentModal'
import { BillingSubNav } from '../../BillingSubNav'
import { fetchJson } from '@/lib/fetch-json'
import type { BillingInvoiceStatus } from '@/types'

interface InvoiceItem {
  id: string
  kind?: string
  description: string
  quantity: string
  unit_price: string
  total: string
  subtotal?: string
}

interface InvoicePayment {
  id: string
  payment_number: string
  payment_date: string
  amount: string
  payment_method: string
}

interface OrgRef {
  id: string
  name: string
  legal_name: string | null
}

interface Invoice {
  id: string
  org_id: string | null
  subscription_id: string | null
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
  billed_seats?: number | null
  billed_branches?: number | null
  organization?: OrgRef | null
  issuer_legal_name: string | null
  issuer_cuit: string | null
  issuer_iva_condition: string | null
  issuer_fiscal_address: string | null
  issuer_gross_income: string | null
  issuer_email: string | null
  issuer_phone: string | null
  items?: InvoiceItem[]
  payments?: InvoicePayment[]
}

const IVA_CONDITION_LABELS: Record<string, string> = {
  responsable_inscripto: 'Responsable Inscripto',
  monotributista: 'Monotributista',
  exento: 'Exento',
  no_responsable: 'No Responsable',
  consumidor_final: 'Consumidor Final',
}

const INVOICE_STATUS_LABELS: Record<BillingInvoiceStatus, string> = {
  draft: 'Borrador',
  issued: 'Emitida',
  partially_paid: 'Pago parcial',
  paid: 'Pagada',
  void: 'Anulada',
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  check: 'Cheque',
  card: 'Tarjeta',
  other: 'Otro',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function orgDisplayName(org: OrgRef | null | undefined): string {
  if (!org) return '—'
  return org.legal_name?.trim() || org.name
}

export function BillingInvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const router = useRouter()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [payOpen, setPayOpen] = useState(false)

  const loadInvoice = useCallback(async (cancelled: () => boolean) => {
    setLoading(true)
    try {
      const inv = await fetchJson<Invoice>(`/api/v1/sys-admin/billing/invoices/${invoiceId}`)
      if (cancelled()) return
      setInvoice(inv)
      setNotFound(false)
    } catch {
      if (!cancelled()) {
        setInvoice(null)
        setNotFound(true)
      }
    } finally {
      if (!cancelled()) setLoading(false)
    }
  }, [invoiceId])

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setLoading before async fetch
    void loadInvoice(() => cancelled)
    return () => { cancelled = true }
  }, [loadInvoice, refresh])

  const backHref = invoice?.subscription_id
    ? `/sys-admin/billing/suscripciones/${invoice.subscription_id}`
    : '/sys-admin/billing'

  const canRegisterPayment =
    invoice?.status === 'issued' || invoice?.status === 'partially_paid'

  const topBarActions = invoice ? (
    <div className="flex items-center gap-2">
      <Link href={`/sys-admin/billing/facturas/${invoice.id}/print`} target="_blank" rel="noopener noreferrer">
        <Button variant="secondary" size="sm">Imprimir</Button>
      </Link>
      {canRegisterPayment && (
        <Button size="sm" onClick={() => setPayOpen(true)}>Registrar pago</Button>
      )}
    </div>
  ) : null

  const paymentColumns: Column<InvoicePayment>[] = [
    { key: 'payment_number', header: 'Número', mobileRole: 'title', render: r => <span className="font-mono text-[12px] text-fg">{r.payment_number}</span> },
    { key: 'payment_date', header: 'Fecha', mobileRole: 'subtitle', render: r => <span className="text-fg-muted tabular-nums">{formatDate(r.payment_date)}</span> },
    { key: 'payment_method', header: 'Medio', mobileRole: 'subtitle', render: r => <span className="text-fg-muted">{METHOD_LABELS[r.payment_method] ?? r.payment_method}</span> },
    { key: 'amount', header: 'Importe', align: 'right', mobileRole: 'amount', render: r => <span className="tabular-nums">{formatARS(r.amount)}</span> },
  ]

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Facturación', href: '/sys-admin/billing' },
          ...(invoice?.subscription_id
            ? [{ label: 'Suscripción', href: `/sys-admin/billing/suscripciones/${invoice.subscription_id}` }]
            : []),
          { label: invoice?.invoice_number ?? 'Factura' },
        ]}
        actions={topBarActions}
      />

      <BillingSubNav />

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
              <div className="sm:col-span-2">
                <dt className="text-[12px] text-fg-muted">Organización</dt>
                <dd className="text-[14px] font-medium text-fg">
                  {invoice.organization ? (
                    <Link
                      href={`/sys-admin/organizaciones/${invoice.organization.id}`}
                      className="text-accent hover:underline"
                    >
                      {orgDisplayName(invoice.organization)}
                    </Link>
                  ) : (
                    '—'
                  )}
                </dd>
                {invoice.organization?.legal_name && invoice.organization.legal_name !== invoice.organization.name && (
                  <dd className="text-[12px] text-fg-muted mt-0.5">{invoice.organization.name}</dd>
                )}
              </div>
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

            {invoice.status === 'draft' && !invoice.issuer_legal_name && (
              <p className="text-[12px] text-fg-muted bg-surface border border-border rounded-sm px-3 py-2 mb-4">
                Borrador: los datos del emisor se guardan al emitir la factura.
              </p>
            )}

            {invoice.issuer_legal_name && (
              <section className="mb-4 rounded-md border border-border bg-surface px-4 py-3">
                <h2 className="text-[13px] font-semibold text-fg mb-1">Emisor</h2>
                <p className="text-[14px] font-medium text-fg">{invoice.issuer_legal_name}</p>
                <div className="mt-0.5 text-[12px] text-fg-muted leading-relaxed">
                  {invoice.issuer_cuit && <span>CUIT {invoice.issuer_cuit}</span>}
                  {invoice.issuer_iva_condition && (
                    <span> · {IVA_CONDITION_LABELS[invoice.issuer_iva_condition] ?? invoice.issuer_iva_condition}</span>
                  )}
                  {invoice.issuer_gross_income && <span> · IIBB {invoice.issuer_gross_income}</span>}
                  {invoice.issuer_fiscal_address && <div>{invoice.issuer_fiscal_address}</div>}
                  {(invoice.issuer_email || invoice.issuer_phone) && (
                    <div>{[invoice.issuer_email, invoice.issuer_phone].filter(Boolean).join(' · ')}</div>
                  )}
                </div>
              </section>
            )}

            <section className="mb-4">
              <h2 className="text-[13px] font-semibold text-fg mb-2">Detalle de facturación</h2>
              <p className="text-[12px] text-fg-muted mb-3">
                Desglose del plan contratado, add-ons, capacidad utilizada y consumo medido del período.
                {invoice.billed_seats != null && invoice.billed_branches != null && (
                  <>
                    {' '}Snapshot al generar: {invoice.billed_seats} usuarios · {invoice.billed_branches} sucursales.
                  </>
                )}
              </p>
              <BillingInvoiceItemsBreakdown items={invoice.items ?? []} />
              <div className="mt-2 flex flex-col items-end gap-0.5 text-[13px]">
                <div className="flex gap-6"><span className="text-fg-muted">Subtotal</span><span className="tabular-nums w-28 text-right">{formatARS(invoice.subtotal)}</span></div>
                <div className="flex gap-6"><span className="text-fg-muted">IVA</span><span className="tabular-nums w-28 text-right">{formatARS(invoice.tax_amount)}</span></div>
                <div className="flex gap-6 font-semibold text-fg"><span>Total</span><span className="tabular-nums w-28 text-right">{formatARS(invoice.total)}</span></div>
              </div>
            </section>

            <section className="mb-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h2 className="text-[13px] font-semibold text-fg">Pagos</h2>
                {canRegisterPayment && (
                  <Button variant="ghost" size="xs" onClick={() => setPayOpen(true)}>+ Registrar pago</Button>
                )}
              </div>
              <DataTable
                columns={paymentColumns}
                data={invoice.payments ?? []}
                keyExtractor={r => r.id}
                emptyMessage="Sin pagos registrados."
              />
            </section>
          </>
        )}

        <div className="mt-4">
          <Button variant="ghost" size="xs" onClick={() => router.push(backHref)}>← Volver</Button>
        </div>
      </PageBody>

      <RecordPaymentModal
        open={payOpen}
        invoice={invoice ? { id: invoice.id, invoice_number: invoice.invoice_number, balance: invoice.balance } : null}
        onClose={() => setPayOpen(false)}
        onSaved={() => setRefresh(r => r + 1)}
      />
    </div>
  )
}
