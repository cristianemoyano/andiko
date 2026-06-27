'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, type Column } from '@/components/erp'
import { StatusBadge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { SubscriptionModal } from './SubscriptionModal'
import { fetchJson } from '@/lib/fetch-json'
import type { SubscriptionStatus } from '@/types'

interface PlanRef {
  id: string
  name: string
  base_price: string
  interval: string
}

export interface SubscriptionRow {
  id: string
  org_id: string
  status: SubscriptionStatus
  seats: number
  current_period_end: string | null
  plan: PlanRef | null
}

interface OrgRef {
  id: string
  name: string
}

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: 'Prueba',
  active: 'Activa',
  past_due: 'Vencida',
  paused: 'Pausada',
  cancelled: 'Cancelada',
}

export function BillingClient() {
  const router = useRouter()
  const [rows, setRows] = useState<SubscriptionRow[]>([])
  const [orgNames, setOrgNames] = useState<Record<string, string>>({})
  const [refresh, setRefresh] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)

  const orgName = useCallback((id: string) => orgNames[id] ?? id, [orgNames])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [subs, orgs] = await Promise.all([
          fetchJson<{ data: SubscriptionRow[] }>('/api/v1/sys-admin/billing/subscriptions?limit=100'),
          fetchJson<{ data: OrgRef[] }>('/api/v1/sys-admin/organizations'),
        ])
        if (cancelled) return
        setRows(subs.data ?? [])
        setOrgNames(Object.fromEntries((orgs.data ?? []).map(o => [o.id, o.name])))
      } catch {
        if (!cancelled) setRows([])
      }
    })()
    return () => { cancelled = true }
  }, [refresh])

  const activeCount = rows.filter(r => r.status === 'active').length
  const pastDueCount = rows.filter(r => r.status === 'past_due').length

  const columns: Column<SubscriptionRow>[] = [
    {
      key: 'org',
      header: 'Organización',
      mobileRole: 'title',
      render: row => <span className="font-medium text-fg">{orgName(row.org_id)}</span>,
    },
    {
      key: 'plan',
      header: 'Plan',
      mobileRole: 'subtitle',
      render: row => <span className="text-fg-muted">{row.plan?.name ?? '—'}</span>,
    },
    {
      key: 'seats',
      header: 'Usuarios',
      align: 'right',
      mobileRole: 'subtitle',
      render: row => <span className="tabular-nums">{row.seats}</span>,
    },
    {
      key: 'base_price',
      header: 'Precio base',
      align: 'right',
      mobileRole: 'amount',
      render: row => <span className="tabular-nums">{row.plan ? formatARS(row.plan.base_price) : '—'}</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      mobileRole: 'badge',
      render: row => <StatusBadge value={STATUS_LABELS[row.status]} />,
    },
    {
      key: '_actions',
      header: '',
      mobileRole: 'actions',
      render: row => (
        <Button variant="ghost" size="xs" onClick={() => router.push(`/sys-admin/billing/suscripciones/${row.id}`)}>
          Gestionar
        </Button>
      ),
    },
  ]

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Facturación' }]}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => router.push('/sys-admin/billing/planes')}>
              Planes
            </Button>
            <Button size="sm" onClick={() => setModalOpen(true)}>
              + Nueva suscripción
            </Button>
          </div>
        }
      />

      <PageBody>
        <div className="flex flex-wrap gap-3 mb-4">
          <SummaryCard label="Suscripciones" value={String(rows.length)} />
          <SummaryCard label="Activas" value={String(activeCount)} />
          <SummaryCard label="Vencidas" value={String(pastDueCount)} tone={pastDueCount > 0 ? 'danger' : 'default'} />
        </div>

        <DataTable
          columns={columns}
          data={rows}
          keyExtractor={r => r.id}
          emptyMessage="No hay suscripciones. Creá la primera."
          onRowClick={row => router.push(`/sys-admin/billing/suscripciones/${row.id}`)}
        />
      </PageBody>

      <SubscriptionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => setRefresh(r => r + 1)}
      />
    </div>
  )
}

function SummaryCard({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'danger' }) {
  return (
    <div className="rounded-md border border-border bg-surface px-4 py-3 min-w-[140px]">
      <div className="text-[12px] text-fg-muted">{label}</div>
      <div className={`text-[20px] font-semibold tabular-nums ${tone === 'danger' ? 'text-danger' : 'text-fg'}`}>{value}</div>
    </div>
  )
}
