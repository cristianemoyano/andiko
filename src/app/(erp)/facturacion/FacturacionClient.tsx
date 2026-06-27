'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, type Column, StatCard, EmptyState } from '@/components/erp'
import { StatusBadge } from '@/components/primitives/Badge'
import { Skeleton } from '@/components/primitives/Skeleton'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { fetchJson } from '@/lib/fetch-json'
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

interface UsageSummary {
  period_start: string
  period_end: string
  lines: UsageLine[]
  total: string
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

export function FacturacionClient() {
  const router = useRouter()
  const [sub, setSub] = useState<Subscription | null>(null)
  const [usage, setUsage] = useState<UsageSummary | null>(null)
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!cancelled) setLoading(true)
      try {
        const [overview, inv] = await Promise.all([
          fetchJson<{ subscription: Subscription | null; usage: UsageSummary | null }>('/api/v1/billing/subscription'),
          fetchJson<{ data: InvoiceRow[] }>('/api/v1/billing/invoices?limit=100'),
        ])
        if (cancelled) return
        setSub(overview.subscription)
        setUsage(overview.usage)
        setInvoices(inv.data ?? [])
      } catch {
        if (!cancelled) { setSub(null); setUsage(null); setInvoices([]) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const pendingBalance = invoices
    .filter(i => i.status !== 'void')
    .reduce((acc, i) => acc + Number(i.balance), 0)

  const columns: Column<InvoiceRow>[] = [
    { key: 'invoice_number', header: 'Número', mobileRole: 'title', render: r => <span className="font-mono text-[12px] text-fg">{r.invoice_number}</span> },
    { key: 'issue_date', header: 'Emisión', mobileRole: 'subtitle', render: r => <span className="text-fg-muted tabular-nums">{formatDate(r.issue_date)}</span> },
    { key: 'status', header: 'Estado', mobileRole: 'badge', render: r => <StatusBadge value={INVOICE_STATUS_LABELS[r.status]} /> },
    { key: 'total', header: 'Total', align: 'right', mobileRole: 'amount', render: r => <span className="tabular-nums">{formatARS(r.total)}</span> },
    { key: 'balance', header: 'Saldo', align: 'right', mobileRole: 'subtitle', render: r => <span className="tabular-nums">{formatARS(r.balance)}</span> },
  ]

  return (
    <div className="flex flex-col h-full">
      <TopBar breadcrumbs={[{ label: 'Facturación' }]} />

      <PageBody>
        {loading ? (
          <div className="flex flex-col gap-4">
            <Skeleton shape="block" className="h-24 w-full" />
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} shape="block" className="h-12 w-full" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Subscription summary */}
            {sub ? (
              <dl className="rounded-md border border-border bg-surface px-4 py-3 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
                <div>
                  <dt className="text-[12px] text-fg-muted">Plan</dt>
                  <dd className="text-[14px] font-medium text-fg">{sub.plan?.name ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-fg-muted">Estado</dt>
                  <dd className="mt-0.5"><StatusBadge value={SUBSCRIPTION_STATUS_LABELS[sub.status]} /></dd>
                </div>
                <div>
                  <dt className="text-[12px] text-fg-muted">Usuarios</dt>
                  <dd className="text-[14px] font-medium text-fg tabular-nums">{sub.seats}</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-fg-muted">Precio base</dt>
                  <dd className="text-[14px] font-medium text-fg tabular-nums">{sub.plan ? formatARS(sub.plan.base_price) : '—'}</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-fg-muted">Próximo período</dt>
                  <dd className="text-[14px] font-medium text-fg tabular-nums">{formatDate(sub.current_period_end)}</dd>
                </div>
              </dl>
            ) : (
              <div className="mb-4">
                <EmptyState
                  title="Sin suscripción activa"
                  description="Tu organización todavía no tiene una suscripción. Contactá a soporte para activar un plan."
                />
              </div>
            )}

            {/* Usage this period */}
            {sub && (
              <section className="mb-4">
                <h2 className="text-[13px] font-semibold text-fg mb-2">Consumo del período actual</h2>
                <div className="flex flex-wrap gap-3 mb-3">
                  <StatCard label="Costo de consumo" value={formatARS(usage?.total ?? '0.00')} />
                  <StatCard label="Saldo pendiente" value={formatARS(pendingBalance.toFixed(2))} tone={pendingBalance > 0 ? 'warning' : 'default'} />
                </div>
                {usage && usage.lines.length > 0 ? (
                  <DataTable
                    columns={[
                      { key: 'label', header: 'Métrica', mobileRole: 'title', render: (l: UsageLine) => <span className="text-fg">{l.label}</span> },
                      { key: 'quantity', header: 'Cantidad', align: 'right', mobileRole: 'subtitle', render: (l: UsageLine) => <span className="tabular-nums">{l.quantity}{l.unit_label ? ` ${l.unit_label}` : ''}</span> },
                      { key: 'unit_price', header: 'Precio unit.', align: 'right', mobileRole: 'subtitle', render: (l: UsageLine) => <span className="tabular-nums">{formatARS(l.unit_price)}</span> },
                      { key: 'amount', header: 'Importe', align: 'right', mobileRole: 'amount', render: (l: UsageLine) => <span className="tabular-nums">{formatARS(l.amount)}</span> },
                    ]}
                    data={usage.lines}
                    keyExtractor={l => l.metric_key}
                    emptyMessage="Sin consumo registrado en el período."
                  />
                ) : (
                  <p className="text-[13px] text-fg-muted">Sin consumo registrado en el período actual.</p>
                )}
              </section>
            )}

            {/* Invoices */}
            <section>
              <h2 className="text-[13px] font-semibold text-fg mb-2">Facturas</h2>
              <DataTable
                columns={columns}
                data={invoices}
                keyExtractor={r => r.id}
                emptyMessage="No hay facturas todavía."
                onRowClick={row => router.push(`/facturacion/${row.id}`)}
              />
            </section>

            <p className="mt-4 text-[12px] text-fg-subtle">
              Para cambios en tu plan o suscripción, contactá a soporte.
            </p>
          </>
        )}
      </PageBody>
    </div>
  )
}
