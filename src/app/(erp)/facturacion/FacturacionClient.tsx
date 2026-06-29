'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody, Card, CardHeader, CardContent } from '@/components/layout'
import { DataTable, type Column, EmptyState } from '@/components/erp'
import { BillingPeriodPreviewSection, type BillingPreview, type BillingUsageSummary } from '@/components/erp/billing/BillingPeriodPreviewSection'
import { BillingOverviewKpis } from '@/components/erp/billing/BillingOverviewKpis'
import { BillingOverviewCharts } from '@/components/erp/billing/BillingOverviewCharts'
import { invoicesToBarData, previewLinesToDonutSegments, usageLinesToBarData, billableUsageNetFromPreview } from '@/components/erp/billing/billing-chart-data'
import { StatusBadge } from '@/components/primitives/Badge'
import { Skeleton } from '@/components/primitives/Skeleton'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { fetchJson } from '@/lib/fetch-json'
import { ORG_MODULE_DEFS } from '@/modules/auth/organization-modules'
import type { SubscriptionStatus, BillingInvoiceStatus } from '@/types'

interface PlanRef {
  id: string
  name: string
  base_price: string
  per_seat_price: string
  included_seats: number
  interval: string
}

interface AddonRef {
  module_key: string
  unit_price: string
  enabled: boolean
}

interface Subscription {
  id: string
  status: SubscriptionStatus
  seats: number
  current_period_end: string | null
  plan: PlanRef | null
  addons?: AddonRef[]
}

interface UsageLine {
  metric_key: string
  label: string
  unit_label: string | null
  unit_price: string
  quantity: string
  amount: string
}

interface UsageSummary extends BillingUsageSummary {
  lines: UsageLine[]
}

interface InvoiceRow {
  id: string
  invoice_number: string
  status: BillingInvoiceStatus
  issue_date: string | null
  due_date: string | null
  total: string
  balance: string
}

const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: 'Prueba',
  active: 'Activa',
  past_due: 'Vencida',
  paused: 'Pausada',
  cancelled: 'Cancelada',
}

const INVOICE_STATUS_LABELS: Record<BillingInvoiceStatus, string> = {
  draft: 'Borrador',
  issued: 'Emitida',
  partially_paid: 'Pago parcial',
  paid: 'Pagada',
  void: 'Anulada',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatPeriodRange(start: string, end: string): string {
  return `${formatDate(start)} – ${formatDate(end)}`
}

function planPriceLabel(plan: PlanRef): string {
  const interval = plan.interval === 'year' ? 'año' : 'mes'
  return `${formatARS(plan.base_price)}/${interval} + IVA`
}

function moduleLabel(key: string): string {
  return ORG_MODULE_DEFS.find(d => d.key === key)?.label ?? key
}

function contractedAddonsSummary(addons?: AddonRef[]): string | null {
  const paid = (addons ?? []).filter(a => a.enabled && Number(a.unit_price) > 0).map(a => moduleLabel(a.module_key))
  return paid.length > 0 ? paid.join(' · ') : null
}

export function FacturacionClient() {
  const router = useRouter()
  const [sub, setSub] = useState<Subscription | null>(null)
  const [usage, setUsage] = useState<UsageSummary | null>(null)
  const [preview, setPreview] = useState<BillingPreview | null>(null)
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!cancelled) setLoading(true)
      try {
        const [overview, inv] = await Promise.all([
          fetchJson<{ subscription: Subscription | null; usage: UsageSummary | null; preview: BillingPreview | null }>('/api/v1/billing/subscription'),
          fetchJson<{ data: InvoiceRow[] }>('/api/v1/billing/invoices?limit=100'),
        ])
        if (cancelled) return
        setSub(overview.subscription)
        setUsage(overview.usage)
        setPreview(overview.preview)
        setInvoices(inv.data ?? [])
      } catch {
        if (!cancelled) { setSub(null); setUsage(null); setPreview(null); setInvoices([]) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const pendingBalance = invoices
    .filter(i => i.status !== 'void' && i.status !== 'paid')
    .reduce((acc, i) => acc + Number(i.balance), 0)
    .toFixed(2)

  const addonsSummary = sub ? contractedAddonsSummary(sub.addons) : null

  const estimateSegments = useMemo(
    () => (preview ? previewLinesToDonutSegments(preview.lines) : []),
    [preview],
  )
  const usageBarData = useMemo(
    () => usageLinesToBarData(usage?.lines ?? []),
    [usage],
  )
  const invoiceBarData = useMemo(
    () => invoicesToBarData(invoices),
    [invoices],
  )
  const billableUsageNet = useMemo(
    () => (preview ? billableUsageNetFromPreview(preview.lines) : '0.00'),
    [preview],
  )

  const columns: Column<InvoiceRow>[] = [
    { key: 'invoice_number', header: 'Número', mobileRole: 'title', render: r => <span className="font-mono text-[12px] text-fg">{r.invoice_number}</span> },
    { key: 'issue_date', header: 'Emisión', mobileRole: 'subtitle', render: r => <span className="text-fg-muted tabular-nums text-[12px]">{formatDate(r.issue_date)}</span> },
    { key: 'status', header: 'Estado', mobileRole: 'badge', render: r => <StatusBadge value={INVOICE_STATUS_LABELS[r.status]} /> },
    { key: 'total', header: 'Total', align: 'right', mobileRole: 'amount', render: r => <span className="tabular-nums">{formatARS(r.total)}</span> },
    { key: 'balance', header: 'Saldo', align: 'right', mobileRole: 'subtitle', render: r => <span className="tabular-nums">{formatARS(r.balance)}</span> },
  ]

  return (
    <div className="flex flex-col h-full">
      <TopBar breadcrumbs={[{ label: 'Suscripción' }]} />

      <PageBody>
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        {loading ? (
          <div className="flex flex-col gap-6">
            <Skeleton shape="block" className="h-20 w-full rounded-lg" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <Skeleton shape="block" className="h-28 rounded-lg" />
              <Skeleton shape="block" className="h-28 rounded-lg" />
              <Skeleton shape="block" className="h-28 rounded-lg" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Skeleton shape="block" className="h-64 rounded-lg" />
              <Skeleton shape="block" className="h-64 rounded-lg" />
            </div>
          </div>
        ) : !sub ? (
          <Card>
            <CardContent>
              <EmptyState
                title="Sin suscripción activa"
                description="Tu organización todavía no tiene una suscripción. Contactá a soporte para activar un plan."
              />
            </CardContent>
          </Card>
        ) : (
          <>
            <section className="rounded-lg border border-border bg-surface px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[17px] font-semibold text-fg">{sub.plan?.name ?? 'Suscripción'}</h2>
                  <StatusBadge value={SUBSCRIPTION_STATUS_LABELS[sub.status]} />
                </div>
                <p className="mt-1 text-[13px] text-fg-muted">
                  {sub.plan ? planPriceLabel(sub.plan) : '—'}
                  {' · '}
                  {sub.seats} {sub.seats === 1 ? 'usuario' : 'usuarios'} en contrato
                  {sub.current_period_end && (
                    <> · Renueva el {formatDate(sub.current_period_end)}</>
                  )}
                </p>
                {addonsSummary && (
                  <p className="mt-1 text-[12px] text-fg-subtle truncate" title={addonsSummary}>
                    Módulos: {addonsSummary}
                  </p>
                )}
              </div>
              {preview && (
                <div className="shrink-0 text-left sm:text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-subtle">Período actual</p>
                  <p className="text-[13px] font-medium tabular-nums text-fg">
                    {formatPeriodRange(preview.period_start, preview.period_end)}
                  </p>
                </div>
              )}
            </section>

            {preview && (
              <BillingOverviewKpis
                estimatedTotal={preview.total}
                estimatedSubtotal={preview.subtotal}
                estimatedTax={preview.tax_amount}
                pendingBalance={pendingBalance}
                registeredUsageTotal={usage?.total ?? '0.00'}
                billableUsageTotal={billableUsageNet}
                periodLabel={formatPeriodRange(preview.period_start, preview.period_end)}
              />
            )}

            {preview && (
              <BillingOverviewCharts
                estimateSegments={estimateSegments}
                usageBarData={usageBarData}
                invoiceBarData={invoiceBarData}
                estimatedSubtotal={preview.subtotal}
                estimatedTax={preview.tax_amount}
                estimatedTotal={preview.total}
                capacity={{
                  activeUsers: preview.counts.active_users,
                  contractedSeats: preview.counts.contracted_seats,
                  includedSeats: preview.counts.included_seats,
                  activeBranches: preview.counts.active_branches,
                  includedBranches: preview.counts.included_branches,
                }}
              />
            )}

            {preview && (
              <Card>
                <CardContent>
                  <BillingPeriodPreviewSection
                    preview={preview}
                    usage={usage}
                    hideStats
                    collapsible
                    defaultExpanded={false}
                    embedded
                  />
                </CardContent>
              </Card>
            )}

            <Card className="overflow-hidden">
              <CardHeader
                title="Facturas de tu suscripción"
                description="Historial de facturación de tu organización"
              />
              <CardContent className="pt-0">
                <DataTable
                  columns={columns}
                  data={invoices}
                  keyExtractor={r => r.id}
                  emptyMessage="No hay facturas todavía."
                  onRowClick={row => router.push(`/facturacion/${row.id}`)}
                />
              </CardContent>
            </Card>

            <p className="text-[12px] text-fg-subtle pb-2">
              Para cambios en tu plan o suscripción, contactá a soporte.
            </p>
          </>
        )}
        </div>
      </PageBody>
    </div>
  )
}
