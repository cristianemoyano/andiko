'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, type Column } from '@/components/erp'
import { StatusBadge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { PlanModal, type PlanRow } from './PlanModal'
import { fetchJson } from '@/lib/fetch-json'

export function PlanesClient() {
  const router = useRouter()
  const [rows, setRows] = useState<PlanRow[]>([])
  const [refresh, setRefresh] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PlanRow | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const j = await fetchJson<{ data: PlanRow[] }>('/api/v1/sys-admin/billing/plans?limit=100')
        if (!cancelled) setRows(j.data ?? [])
      } catch {
        if (!cancelled) setRows([])
      }
    })()
    return () => { cancelled = true }
  }, [refresh])

  function openCreate() { setEditing(null); setModalOpen(true) }
  function openEdit(row: PlanRow) { setEditing(row); setModalOpen(true) }

  const columns: Column<PlanRow>[] = [
    { key: 'name', header: 'Plan', mobileRole: 'title', render: r => <span className="font-medium text-fg">{r.name}</span> },
    { key: 'code', header: 'Código', mobileRole: 'subtitle', render: r => <span className="font-mono text-[12px] text-fg-muted">{r.code}</span> },
    { key: 'interval', header: 'Ciclo', mobileRole: 'subtitle', render: r => <span className="text-fg-muted">{r.interval === 'annual' ? 'Anual' : 'Mensual'}</span> },
    { key: 'base_price', header: 'Precio base', align: 'right', mobileRole: 'amount', render: r => <span className="tabular-nums">{formatARS(r.base_price)}</span> },
    { key: 'per_seat_price', header: 'Por usuario', align: 'right', mobileRole: 'subtitle', render: r => <span className="tabular-nums">{formatARS(r.per_seat_price)}</span> },
    { key: 'is_active', header: 'Estado', mobileRole: 'badge', render: r => <StatusBadge value={r.is_active ? 'Activo' : 'Inactivo'} /> },
    {
      key: '_actions', header: '', mobileRole: 'actions',
      render: r => <Button variant="ghost" size="xs" onClick={() => openEdit(r)}>Editar</Button>,
    },
  ]

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Facturación', href: '/sys-admin/billing' }, { label: 'Planes' }]}
        actions={<Button size="sm" onClick={openCreate}>+ Nuevo plan</Button>}
      />
      <PageBody>
        <DataTable
          columns={columns}
          data={rows}
          keyExtractor={r => r.id}
          emptyMessage="No hay planes. Creá el primero."
          onRowClick={openEdit}
        />
        <div className="mt-4">
          <Button variant="ghost" size="xs" onClick={() => router.push('/sys-admin/billing')}>← Volver a suscripciones</Button>
        </div>
      </PageBody>

      <PlanModal
        open={modalOpen}
        plan={editing}
        onClose={() => setModalOpen(false)}
        onSaved={() => setRefresh(r => r + 1)}
      />
    </div>
  )
}
