'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { StatusBadge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { ContabilidadSubNav } from '../ContabilidadSubNav'
import { AsientoModal } from './AsientoModal'
import { ENTRY_STATUS_LABEL, type JournalEntryListItem } from '../types'

const PAGE_SIZE = 20

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'draft', label: 'Borrador' },
  { value: 'posted', label: 'Contabilizado' },
] as const

function formatDate(value: string): string {
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
}

export function AsientosClient() {
  const router = useRouter()
  const [entries, setEntries] = useState<JournalEntryListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [serverError, setServerError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (search) params.set('search', search)
    if (statusFilter) params.set('status', statusFilter)
    ;(async () => {
      setServerError(null)
      try {
        const data = await fetchJson<{ data: JournalEntryListItem[]; total: number }>(`/api/v1/accounting/journal-entries?${params}`)
        if (!mounted) return
        setEntries(data.data)
        setTotal(data.total)
        const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE))
        setPage(p => (p > pages ? pages : p))
      } catch (e) {
        if (!mounted) return
        setServerError(getApiErrorMessage(e))
        setEntries([])
        setTotal(0)
      }
    })()
    return () => { mounted = false }
  }, [page, search, statusFilter, refresh])

  function handleSaved(entryId: string) {
    setModalOpen(false)
    setRefresh(r => r + 1)
    router.push(`/contabilidad/asientos/${entryId}`)
  }

  const columns: Column<JournalEntryListItem>[] = [
    {
      key: 'entry_number',
      header: 'N°',
      render: row => <span className="font-mono text-[12px] text-fg-muted">{row.entry_number}</span>,
    },
    {
      key: 'entry_date',
      header: 'Fecha',
      render: row => <span className="text-[13px] text-fg">{formatDate(row.entry_date)}</span>,
    },
    {
      key: 'description',
      header: 'Descripción',
      render: row => row.description
        ? <span className="text-[13px] text-fg">{row.description}</span>
        : <span className="text-fg-subtle">—</span>,
    },
    {
      key: 'total_debit',
      header: 'Importe',
      render: row => <span className="font-mono text-[12px] text-fg-muted">{formatARS(row.total_debit)}</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      render: row => <StatusBadge value={ENTRY_STATUS_LABEL[row.status] ?? row.status} />,
    },
  ]

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Contabilidad' }, { label: 'Asientos' }]}
        actions={<Button size="sm" onClick={() => setModalOpen(true)}>+ Nuevo asiento</Button>}
      />
      <ContabilidadSubNav />

      <div className="flex-1 p-5 overflow-auto">
        {serverError && (
          <div className="mb-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
            {serverError}
          </div>
        )}
        <DataTable
          columns={columns}
          data={entries}
          keyExtractor={r => r.id}
          onRowClick={row => router.push(`/contabilidad/asientos/${row.id}`)}
          emptyMessage="No hay asientos. Creá el primero."
          toolbar={
            <>
              <div className="relative flex items-center w-full sm:w-auto">
                <svg className="absolute left-2 text-fg-subtle pointer-events-none" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/>
                </svg>
                <input
                  className="pl-7 pr-3 h-[30px] text-[13px] border border-border-strong rounded-sm w-full sm:w-56 bg-surface focus:outline-none focus:border-ring"
                  placeholder="Buscar por número o descripción…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                />
              </div>
              <select
                className="h-[30px] text-[13px] border border-border-strong rounded-sm px-2 bg-surface focus:outline-none focus:border-ring text-fg-muted"
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
              >
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <span className="flex-1" />
              <span className="text-[12px] text-fg-muted">{total} registro{total !== 1 ? 's' : ''}</span>
            </>
          }
          footer={total > 0 ? <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} /> : undefined}
        />
      </div>

      <AsientoModal open={modalOpen} entry={null} onOpenChange={setModalOpen} onSaved={handleSaved} />
    </div>
  )
}
