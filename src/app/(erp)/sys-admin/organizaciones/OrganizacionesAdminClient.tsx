'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { DataTable, type Column } from '@/components/erp'
import { StatusBadge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { OrganizationModal } from './OrganizationModal'
import { fetchJson } from '@/lib/fetch-json'

export interface OrgAdminRow {
  id: string
  name: string
  slug: string
  is_active: boolean
  created_at: string
  branch_count: number
}

const COLUMNS: Column<OrgAdminRow>[] = [
  {
    key: 'name',
    header: 'Organización',
    sortable: true,
    render: row => <span className="font-medium text-fg">{row.name}</span>,
  },
  {
    key: 'slug',
    header: 'Slug',
    render: row => <span className="font-mono text-[12px] text-fg-muted">{row.slug}</span>,
  },
  {
    key: 'branch_count',
    header: 'Sucursales',
    render: row => <span className="tabular-nums">{row.branch_count}</span>,
  },
  {
    key: 'is_active',
    header: 'Estado',
    render: row => (
      <StatusBadge value={row.is_active ? 'Activa' : 'Inactiva'} />
    ),
  },
]

export function OrganizacionesAdminClient() {
  const router = useRouter()
  const [rows, setRows] = useState<OrgAdminRow[]>([])
  const [refresh, setRefresh] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await Promise.resolve()
      try {
        const j = await fetchJson<{ data: OrgAdminRow[] }>('/api/v1/sys-admin/organizations')
        if (!cancelled) setRows(j.data ?? [])
      } catch {
        if (!cancelled) setRows([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refresh])

  const columnsWithActions: Column<OrgAdminRow>[] = [
    ...COLUMNS,
    {
      key: '_actions',
      header: '',
      render: row => (
        <Button variant="ghost" size="xs" onClick={() => router.push(`/sys-admin/organizaciones/${row.id}`)}>
          Gestionar
        </Button>
      ),
    },
  ]

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Sys-admin', href: '/sys-admin/organizaciones' }, { label: 'Organizaciones' }]}
        actions={
          <Button size="sm" onClick={() => setModalOpen(true)}>
            + Nueva organización
          </Button>
        }
      />

      <div className="flex-1 p-5 overflow-auto">
        <DataTable
          columns={columnsWithActions}
          data={rows}
          keyExtractor={r => r.id}
          emptyMessage="No hay organizaciones. Creá la primera."
        />
      </div>

      <OrganizationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => setRefresh(r => r + 1)}
      />
    </div>
  )
}
