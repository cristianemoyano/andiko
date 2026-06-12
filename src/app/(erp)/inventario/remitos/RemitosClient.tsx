'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/primitives/Button'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { StatusBadge } from '@/components/primitives/Badge'
import { InventarioSubNav } from '../InventarioSubNav'
import type { DeliveryNote, DeliveryNoteStatus } from './types'
import { DELIVERY_NOTE_STATUS_LABEL } from './types'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

const PAGE_SIZE = 20

const STATUS_OPTIONS: { value: DeliveryNoteStatus | ''; label: string }[] = [
  { value: '',          label: 'Todos los estados' },
  { value: 'draft',     label: 'Borrador' },
  { value: 'issued',    label: 'Emitido' },
  { value: 'delivered', label: 'Entregado' },
  { value: 'annulled',  label: 'Anulado' },
]

const COLUMNS: Column<DeliveryNote>[] = [
  {
    key: 'delivery_number',
    header: 'N°',
    render: row => <span className="font-mono text-[12px] text-zinc-600">{row.delivery_number}</span>,
  },
  {
    key: 'contact',
    header: 'Cliente',
    render: row =>
      row.contact ? (
        <span className="font-medium text-zinc-900">{row.contact.legal_name}</span>
      ) : (
        <span className="text-zinc-400">—</span>
      ),
  },
  {
    key: 'warehouse',
    header: 'Depósito',
    render: row =>
      row.warehouse ? <span className="text-zinc-700">{row.warehouse.name}</span> : <span className="text-zinc-400">—</span>,
  },
  {
    key: 'status',
    header: 'Estado',
    render: row => <StatusBadge value={DELIVERY_NOTE_STATUS_LABEL[row.status]} />,
  },
  {
    key: 'delivery_date',
    header: 'Fecha',
    render: row =>
      row.delivery_date
        ? new Date(row.delivery_date).toLocaleDateString('es-AR')
        : <span className="text-zinc-400">—</span>,
  },
]

export function RemitosClient() {
  const router = useRouter()
  const [notes, setNotes]   = useState<DeliveryNote[] | null>(null)
  const [total, setTotal]   = useState(0)
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<DeliveryNoteStatus | ''>('')
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (search) params.set('search', search)
    if (status) params.set('status', status)
    ;(async () => {
      try {
        const d = await fetchJson<{ data: DeliveryNote[]; total: number }>(`/api/v1/inventory/delivery-notes?${params}`)
        if (!mounted) return
        setNotes(d.data ?? [])
        setTotal(d.total ?? 0)
        setError(null)
      } catch (e) {
        if (!mounted) return
        setError(getApiErrorMessage(e))
        setNotes([])
        setTotal(0)
      }
    })()
    return () => { mounted = false }
  }, [page, search, status])

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Inventario', href: '/inventario/depositos' }, { label: 'Remitos' }]}
        actions={
          <Button size="sm" onClick={() => router.push('/inventario/remitos/nuevo')}>
            Nuevo remito
          </Button>
        }
      />
      <InventarioSubNav />

      <div className="flex-1 p-5 overflow-auto">
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <DataTable
          columns={COLUMNS}
          data={notes}
          keyExtractor={row => row.id}
          onRowClick={row => router.push(`/inventario/remitos/${row.id}`)}
          emptyMessage="No hay remitos registrados"
          toolbar={
            <>
              <div className="relative flex items-center">
                <svg className="absolute left-2 text-zinc-400 pointer-events-none" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/>
                </svg>
                <input
                  type="text"
                  placeholder="Buscar por número…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  className="pl-7 pr-3 h-[30px] text-[13px] border border-zinc-300 rounded-sm w-52 bg-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <select
                value={status}
                onChange={e => { setStatus(e.target.value as DeliveryNoteStatus | ''); setPage(1) }}
                className="h-[30px] text-[13px] border border-zinc-300 rounded-sm px-2 bg-white focus:outline-none focus:border-blue-500 text-zinc-700"
              >
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <span className="flex-1" />
              <span className="text-[12px] text-zinc-500">{total} registro{total !== 1 ? 's' : ''}</span>
            </>
          }
          footer={
            total > 0 ? (
              <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            ) : undefined
          }
        />
      </div>
    </div>
  )
}
