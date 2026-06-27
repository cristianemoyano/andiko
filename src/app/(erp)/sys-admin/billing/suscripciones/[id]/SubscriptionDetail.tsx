'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, type Column } from '@/components/erp'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { StatusBadge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { GenerateInvoiceModal } from './GenerateInvoiceModal'
import { RecordPaymentModal } from './RecordPaymentModal'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import type { BillingInvoiceStatus, SubscriptionStatus } from '@/types'

interface Subscription {
  id: string
  org_id: string
  status: SubscriptionStatus
  seats: number
  plan: { id: string; name: string; base_price: string; per_seat_price: string; included_seats: number } | null
  addons?: { module_key: string; unit_price: string; enabled: boolean }[]
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

const INVOICE_STATUS_LABELS: Record<BillingInvoiceStatus, string> = {
  draft: 'Borrador',
  issued: 'Emitida',
  partially_paid: 'Pago parcial',
  paid: 'Pagada',
  void: 'Anulada',
}

export function SubscriptionDetail({ subscriptionId }: { subscriptionId: string }) {
  const router = useRouter()
  const [sub, setSub] = useState<Subscription | null>(null)
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [refresh, setRefresh] = useState(0)
  const [genOpen, setGenOpen] = useState(false)
  const [payInvoice, setPayInvoice] = useState<InvoiceRow | null>(null)
  const [voidInvoice, setVoidInvoice] = useState<InvoiceRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [s, inv] = await Promise.all([
          fetchJson<Subscription>(`/api/v1/sys-admin/billing/subscriptions/${subscriptionId}`),
          fetchJson<{ data: InvoiceRow[] }>(`/api/v1/sys-admin/billing/invoices?subscription_id=${subscriptionId}&limit=100`),
        ])
        if (cancelled) return
        setSub(s)
        setInvoices(inv.data ?? [])
      } catch {
        if (!cancelled) { setSub(null); setInvoices([]) }
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

  const columns: Column<InvoiceRow>[] = [
    { key: 'invoice_number', header: 'Número', mobileRole: 'title', render: r => <span className="font-mono text-[12px] text-fg">{r.invoice_number}</span> },
    { key: 'status', header: 'Estado', mobileRole: 'badge', render: r => <StatusBadge value={INVOICE_STATUS_LABELS[r.status]} /> },
    { key: 'total', header: 'Total', align: 'right', mobileRole: 'amount', render: r => <span className="tabular-nums">{formatARS(r.total)}</span> },
    { key: 'balance', header: 'Saldo', align: 'right', mobileRole: 'subtitle', render: r => <span className="tabular-nums">{formatARS(r.balance)}</span> },
    {
      key: '_actions', header: '', mobileRole: 'actions',
      render: r => (
        <div className="flex gap-1 justify-end">
          {r.status === 'draft' && <Button variant="ghost" size="xs" onClick={() => issueInvoice(r.id)}>Emitir</Button>}
          {(r.status === 'issued' || r.status === 'partially_paid') && (
            <Button variant="ghost" size="xs" onClick={() => setPayInvoice(r)}>Registrar pago</Button>
          )}
          {(r.status === 'draft' || r.status === 'issued') && Number(r.paid_amount) === 0 && (
            <Button variant="ghost" size="xs" onClick={() => setVoidInvoice(r)}>Anular</Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Facturación', href: '/sys-admin/billing' }, { label: 'Suscripción' }]}
        actions={<Button size="sm" onClick={() => setGenOpen(true)} disabled={!sub}>+ Generar factura</Button>}
      />
      <PageBody>
        {sub && (
          <div className="rounded-md border border-border bg-surface px-4 py-3 mb-4 flex flex-wrap gap-x-8 gap-y-2">
            <Field label="Plan" value={sub.plan?.name ?? '—'} />
            <Field label="Usuarios" value={String(sub.seats)} />
            <Field label="Estado" value={<StatusBadge value={sub.status} />} />
            <Field label="Precio base" value={sub.plan ? formatARS(sub.plan.base_price) : '—'} />
          </div>
        )}

        {error && (
          <p role="alert" className="text-[12px] text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2 mb-4">{error}</p>
        )}

        <DataTable
          columns={columns}
          data={invoices}
          keyExtractor={r => r.id}
          emptyMessage="No hay facturas. Generá la primera."
        />

        <div className="mt-4">
          <Button variant="ghost" size="xs" onClick={() => router.push('/sys-admin/billing')}>← Volver</Button>
        </div>
      </PageBody>

      <GenerateInvoiceModal
        open={genOpen}
        subscriptionId={subscriptionId}
        onClose={() => setGenOpen(false)}
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

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[12px] text-fg-muted">{label}</div>
      <div className="text-[14px] font-medium text-fg">{value}</div>
    </div>
  )
}
