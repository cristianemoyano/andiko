'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, type Column, StatCard } from '@/components/erp'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { StatusBadge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Skeleton } from '@/components/primitives/Skeleton'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/primitives/DropdownMenu'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { GenerateInvoiceModal } from './GenerateInvoiceModal'
import { RecordPaymentModal } from '../../RecordPaymentModal'
import { SubscriptionModal, type SubscriptionForEdit } from '../../SubscriptionModal'
import { BillingPeriodPreviewSection, type BillingPreview, type BillingUsageSummary } from '@/components/erp/billing/BillingPeriodPreviewSection'
import { BillingSubNav } from '../../BillingSubNav'
import { SubscriptionUsageSection } from '../../SubscriptionUsageSection'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import type { BillingInvoiceStatus, SubscriptionStatus } from '@/types'
import { ORG_MODULE_DEFS } from '@/modules/auth/organization-modules'
import { billingExtraLabel } from '@/modules/billing/billing-extras'
import type { TrackedBillingMetricKey } from '@/modules/billing/billing-metrics.catalog'

interface OrgRef {
  id: string
  name: string
  legal_name: string | null
}

interface Subscription {
  id: string
  org_id: string
  plan_id: string
  status: SubscriptionStatus
  seats: number
  plan: { id: string; name: string; base_price: string; per_seat_price: string; included_seats: number } | null
  organization?: OrgRef | null
  addons?: { module_key: string; unit_price: string; enabled: boolean }[]
  extras?: { extra_key: string; unit_price: string; enabled: boolean }[]
  metric_allowances?: { metric_key: string; extra_included_quantity: string }[]
}

function orgDisplayName(org: OrgRef | null | undefined): string {
  if (!org) return '—'
  return org.legal_name?.trim() || org.name
}

function subscriptionForEdit(sub: Subscription): SubscriptionForEdit {
  return {
    id: sub.id,
    org_id: sub.org_id,
    plan_id: sub.plan_id,
    seats: sub.seats,
    status: sub.status,
    addons: sub.addons,
    extras: sub.extras,
    metric_allowances: sub.metric_allowances?.map(a => ({
      metric_key: a.metric_key as TrackedBillingMetricKey,
      extra_included_quantity: a.extra_included_quantity,
    })),
  }
}

function moduleLabel(key: string): string {
  return ORG_MODULE_DEFS.find(d => d.key === key)?.label ?? key
}

function contractedAddonsSummary(sub: Subscription): string | null {
  const paid = (sub.addons ?? []).filter(a => a.enabled && Number(a.unit_price) > 0).map(a => moduleLabel(a.module_key))
  const extras = (sub.extras ?? []).filter(e => e.enabled && Number(e.unit_price) > 0).map(e => billingExtraLabel(e.extra_key))
  const all = [...paid, ...extras]
  return all.length > 0 ? all.join(' · ') : null
}

interface InvoiceRow {
  id: string
  invoice_number: string
  status: BillingInvoiceStatus
  issue_date: string | null
  due_date: string | null
  total: string
  paid_amount: string
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

function InvoiceActionsMenu({
  invoice: r,
  onOpen,
  onIssue,
  onPay,
  onVoid,
}: {
  invoice: InvoiceRow
  onOpen: () => void
  onIssue: () => void
  onPay: () => void
  onVoid: () => void
}) {
  const canPay = r.status === 'issued' || r.status === 'partially_paid'
  const canVoid = (r.status === 'draft' || r.status === 'issued') && Number(r.paid_amount) === 0

  return (
    <>
      <DropdownMenuItem onSelect={onOpen}>Ver detalle</DropdownMenuItem>
      {r.status === 'draft' && (
        <DropdownMenuItem onSelect={onIssue}>Emitir</DropdownMenuItem>
      )}
      {canPay && (
        <DropdownMenuItem onSelect={onPay}>Registrar pago</DropdownMenuItem>
      )}
      {canVoid && (
        <DropdownMenuItem variant="destructive" onSelect={onVoid}>Anular</DropdownMenuItem>
      )}
    </>
  )
}

export function SubscriptionDetail({ subscriptionId }: { subscriptionId: string }) {
  const router = useRouter()
  const [sub, setSub] = useState<Subscription | null>(null)
  const [usage, setUsage] = useState<BillingUsageSummary | null>(null)
  const [preview, setPreview] = useState<BillingPreview | null>(null)
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [genOpen, setGenOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [payInvoice, setPayInvoice] = useState<InvoiceRow | null>(null)
  const [voidInvoice, setVoidInvoice] = useState<InvoiceRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [usageRefresh, setUsageRefresh] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!cancelled) setLoading(true)
      try {
        const [s, inv] = await Promise.all([
          fetchJson<Subscription & { usage: BillingUsageSummary | null; preview: BillingPreview | null }>(`/api/v1/sys-admin/billing/subscriptions/${subscriptionId}`),
          fetchJson<{ data: InvoiceRow[] }>(`/api/v1/sys-admin/billing/invoices?subscription_id=${subscriptionId}&limit=100`),
        ])
        if (cancelled) return
        setSub(s)
        setUsage(s.usage ?? null)
        setPreview(s.preview ?? null)
        setInvoices(inv.data ?? [])
      } catch {
        if (!cancelled) { setSub(null); setUsage(null); setPreview(null); setInvoices([]) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [subscriptionId, refresh])

  const issueInvoice = useCallback(async (id: string) => {
    setError(null)
    try {
      await fetchJson(`/api/v1/sys-admin/billing/invoices/${id}`, { method: 'PATCH', body: JSON.stringify({ action: 'issue' }) })
      setRefresh(r => r + 1)
    } catch (e) { setError(getApiErrorMessage(e)) }
  }, [])

  const doVoid = useCallback(async () => {
    if (!voidInvoice) return
    setError(null)
    try {
      await fetchJson(`/api/v1/sys-admin/billing/invoices/${voidInvoice.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'void' }) })
      setRefresh(r => r + 1)
    } catch (e) { setError(getApiErrorMessage(e)) }
  }, [voidInvoice])

  const openInvoice = useCallback((id: string) => {
    router.push(`/sys-admin/billing/facturas/${id}`)
  }, [router])

  const pendingBalance = invoices
    .filter(i => i.status !== 'void' && i.status !== 'paid')
    .reduce((acc, i) => acc + Number(i.balance), 0)
    .toFixed(2)

  const addonsSummary = sub ? contractedAddonsSummary(sub) : null

  const columns: Column<InvoiceRow>[] = [
    {
      key: 'invoice_number',
      header: 'Número',
      mobileRole: 'title',
      render: r => (
        <span className="font-mono text-[12px] text-fg">{r.invoice_number}</span>
      ),
    },
    {
      key: 'issue_date',
      header: 'Emisión',
      mobileRole: 'subtitle',
      render: r => <span className="text-fg-muted tabular-nums text-[12px]">{formatDate(r.issue_date)}</span>,
    },
    { key: 'status', header: 'Estado', mobileRole: 'badge', render: r => <StatusBadge value={INVOICE_STATUS_LABELS[r.status]} /> },
    { key: 'total', header: 'Total', align: 'right', mobileRole: 'amount', render: r => <span className="tabular-nums">{formatARS(r.total)}</span> },
    { key: 'balance', header: 'Saldo', align: 'right', mobileRole: 'subtitle', render: r => <span className="tabular-nums">{formatARS(r.balance)}</span> },
    {
      key: '_actions',
      header: '',
      mobileRole: 'actions',
      render: r => (
        <div className="flex justify-end" onClick={e => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="xs" aria-label="Acciones">···</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <InvoiceActionsMenu
                invoice={r}
                onOpen={() => openInvoice(r.id)}
                onIssue={() => issueInvoice(r.id)}
                onPay={() => setPayInvoice(r)}
                onVoid={() => setVoidInvoice(r)}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
      mobileRender: r => (
        <InvoiceActionsMenu
          invoice={r}
          onOpen={() => openInvoice(r.id)}
          onIssue={() => issueInvoice(r.id)}
          onPay={() => setPayInvoice(r)}
          onVoid={() => setVoidInvoice(r)}
        />
      ),
    },
  ]

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Facturación', href: '/sys-admin/billing' },
          { label: sub?.organization ? orgDisplayName(sub.organization) : 'Suscripción' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)} disabled={!sub}>Editar contrato</Button>
            <Button size="sm" onClick={() => setGenOpen(true)} disabled={!sub}>Generar factura</Button>
          </div>
        }
      />
      <BillingSubNav />
      <PageBody>
        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton shape="block" className="h-28 w-full" />
            <Skeleton shape="block" className="h-40 w-full" />
          </div>
        ) : (
          <>
            {error && (
              <p role="alert" className="text-[12px] text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2 mb-4">{error}</p>
            )}

            {sub && (
              <div className="rounded-md border border-border bg-surface mb-4 overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {sub.organization ? (
                        <Link
                          href={`/sys-admin/organizaciones/${sub.organization.id}`}
                          className="text-[15px] font-semibold text-accent hover:underline truncate"
                        >
                          {orgDisplayName(sub.organization)}
                        </Link>
                      ) : (
                        <span className="text-[15px] font-semibold text-fg">—</span>
                      )}
                      <StatusBadge value={SUBSCRIPTION_STATUS_LABELS[sub.status]} />
                    </div>
                    <p className="text-[13px] text-fg-muted mt-1">
                      {sub.plan?.name ?? '—'}
                      {sub.plan && <> · {formatARS(sub.plan.base_price)}/mes</>}
                      {preview && (
                        <> · {preview.counts.active_users} activos
                          {preview.counts.contracted_seats > preview.counts.active_users && (
                            <> · {preview.counts.contracted_seats} en contrato</>
                          )}
                          {' · '}{preview.counts.active_branches} sucursales</>
                      )}
                    </p>
                    {addonsSummary && (
                      <p className="text-[12px] text-fg-subtle mt-1 truncate" title={addonsSummary}>
                        Add-ons: {addonsSummary}
                      </p>
                    )}
                  </div>
                </div>

                {preview && (
                  <div className="px-4 py-3 flex flex-wrap gap-3 border-b border-border">
                    <StatCard label="Próxima factura (est.)" value={formatARS(preview.total)} />
                    <StatCard
                      label="Saldo pendiente"
                      value={formatARS(pendingBalance)}
                      tone={Number(pendingBalance) > 0 ? 'warning' : 'default'}
                    />
                    <StatCard label="Consumo medido" value={formatARS(usage?.total ?? '0.00')} />
                  </div>
                )}

                {sub && preview && (
                  <div className="px-4 py-3">
                    <BillingPeriodPreviewSection
                      preview={preview}
                      usage={usage}
                      hideStats
                      collapsible
                      defaultExpanded={false}
                    />
                  </div>
                )}
              </div>
            )}

            {sub && (
              <SubscriptionUsageSection
                subscriptionId={subscriptionId}
                orgId={sub.org_id}
                refreshKey={usageRefresh}
                onUsageChanged={() => {
                  setUsageRefresh(r => r + 1)
                  setRefresh(r => r + 1)
                }}
              />
            )}

            <section>
              <h2 className="text-[13px] font-semibold text-fg mb-2">Facturas</h2>
              <DataTable
                columns={columns}
                data={invoices}
                keyExtractor={r => r.id}
                onRowClick={r => openInvoice(r.id)}
                emptyMessage="No hay facturas. Generá la primera."
              />
            </section>
          </>
        )}
      </PageBody>

      <GenerateInvoiceModal
        open={genOpen}
        subscriptionId={subscriptionId}
        onClose={() => setGenOpen(false)}
        onSaved={() => setRefresh(r => r + 1)}
      />

      <SubscriptionModal
        open={editOpen}
        subscription={sub ? subscriptionForEdit(sub) : null}
        onClose={() => setEditOpen(false)}
        onSaved={() => setRefresh(r => r + 1)}
      />

      <RecordPaymentModal
        open={!!payInvoice}
        invoice={payInvoice}
        onClose={() => setPayInvoice(null)}
        onSaved={() => setRefresh(r => r + 1)}
      />

      <ConfirmDialog
        open={!!voidInvoice}
        onOpenChange={v => { if (!v) setVoidInvoice(null) }}
        title="Anular factura"
        description={`¿Anular la factura ${voidInvoice?.invoice_number}? Esta acción no se puede deshacer.`}
        variant="danger"
        confirmLabel="Anular"
        onConfirm={doVoid}
      />
    </div>
  )
}
