'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

interface CashSessionRow {
  id: string
  branch_id: string | null
  cashier_name: string | null
  opened_at: string
  closed_at: string | null
  opening_amount: string
  closing_amount_declared: string | null
  closing_amount_expected: string | null
  difference: string | null
  status: 'open' | 'closed'
}

const ars = (v: string | number | null) =>
  v === null ? '—'
  : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(Number(v))

function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: 'open' | 'closed' }) {
  if (status === 'open') {
    return <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700">Abierto</span>
  }
  return <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500">Cerrado</span>
}

export function CajasClient() {
  const [rows, setRows] = useState<CashSessionRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all')
  const [refresh, setRefresh] = useState(0)

  const PAGE_SIZE = 50

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset before async fetch
    setRows(null)
    setError(null)
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (statusFilter !== 'all') params.set('status', statusFilter)
    ;(async () => {
      try {
        const data = await fetchJson<{ data: CashSessionRow[]; total: number }>(`/api/v1/pos/cash-sessions?${params}`)
        setRows(data.data ?? [])
        setTotal(data.total ?? 0)
      } catch (e) {
        setError(getApiErrorMessage(e))
        setRows([])
      }
    })()
  }, [page, statusFilter, refresh])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'POS' }, { label: 'Turnos de caja' }]}
        actions={
          <button
            onClick={() => setRefresh(r => r + 1)}
            className="text-xs text-zinc-500 hover:text-zinc-900 px-2 py-1.5 rounded hover:bg-zinc-100 transition-colors"
          >
            Actualizar
          </button>
        }
      />

      {/* Filter bar */}
      <div className="border-b border-zinc-200 bg-white px-6 py-2.5 flex items-center gap-2 shrink-0">
        {(['all', 'open', 'closed'] as const).map(s => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1) }}
            className={`text-xs px-3 py-1.5 rounded-[4px] font-medium transition-colors ${
              statusFilter === s
                ? 'bg-[#EEF8FA] text-[#0C647A] border border-[#A2DCE7]'
                : 'text-zinc-500 hover:bg-zinc-100 border border-transparent'
            }`}
          >
            {s === 'all' ? 'Todos' : s === 'open' ? 'Abiertos' : 'Cerrados'}
          </button>
        ))}
        <span className="ml-auto text-xs text-zinc-400">{total} turno{total !== 1 ? 's' : ''}</span>
      </div>

      <div className="flex-1 overflow-auto p-5">
        {error && (
          <div className="mb-4 rounded-[4px] bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {rows === null ? (
          <div className="flex items-center justify-center h-40 text-sm text-zinc-400">Cargando…</div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-zinc-400">
            No hay turnos registrados.
          </div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-[4px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200">
                  {['Apertura', 'Cierre', 'Cajero', 'Efectivo inicial', 'Esperado', 'Declarado', 'Diferencia', 'Estado'].map(h => (
                    <th
                      key={h}
                      className={`text-[11px] font-semibold text-zinc-400 px-3.5 py-2.5 uppercase tracking-[0.03em] ${
                        ['Efectivo inicial', 'Esperado', 'Declarado', 'Diferencia'].includes(h) ? 'text-right' : 'text-left'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const diff = row.difference ? Number(row.difference) : null
                  return (
                    <tr key={row.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50 transition-colors">
                      <td className="font-mono text-[12px] px-3.5 py-2.5 text-zinc-600">{fmtDatetime(row.opened_at)}</td>
                      <td className="font-mono text-[12px] px-3.5 py-2.5 text-zinc-500">
                        {row.closed_at ? fmtDatetime(row.closed_at) : '—'}
                      </td>
                      <td className="text-[13px] px-3.5 py-2.5 text-zinc-800">{row.cashier_name ?? '—'}</td>
                      <td className="font-mono text-[12px] px-3.5 py-2.5 text-right text-zinc-600">{ars(row.opening_amount)}</td>
                      <td className="font-mono text-[12px] px-3.5 py-2.5 text-right text-zinc-600">{ars(row.closing_amount_expected)}</td>
                      <td className="font-mono text-[12px] px-3.5 py-2.5 text-right text-zinc-600">{ars(row.closing_amount_declared)}</td>
                      <td className={`font-mono text-[12px] px-3.5 py-2.5 text-right font-medium ${
                        diff === null ? 'text-zinc-400' : diff === 0 ? 'text-zinc-600' : diff > 0 ? 'text-green-700' : 'text-red-600'
                      }`}>
                        {diff === null ? '—' : `${diff >= 0 ? '+' : ''}${ars(diff)}`}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100 bg-zinc-50">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="text-xs px-3 py-1.5 rounded border border-zinc-200 text-zinc-600 hover:bg-white disabled:opacity-40 transition-colors"
                >
                  Anterior
                </button>
                <span className="text-xs text-zinc-500">Página {page} de {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="text-xs px-3 py-1.5 rounded border border-zinc-200 text-zinc-600 hover:bg-white disabled:opacity-40 transition-colors"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
