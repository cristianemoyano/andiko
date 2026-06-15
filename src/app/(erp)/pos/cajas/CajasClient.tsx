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
    return <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-success-bg text-success">Abierto</span>
  }
  return <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-surface-hover text-fg-muted">Cerrado</span>
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
            className="text-xs text-fg-muted hover:text-fg px-2 py-1.5 rounded hover:bg-surface-hover transition-colors"
          >
            Actualizar
          </button>
        }
      />

      {/* Filter bar */}
      <div className="border-b border-border bg-surface px-6 py-2.5 flex items-center gap-2 shrink-0">
        {(['all', 'open', 'closed'] as const).map(s => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1) }}
            className={`text-xs px-3 py-1.5 rounded-[4px] font-medium transition-colors ${
              statusFilter === s
                ? 'bg-[#EEF8FA] text-[#0C647A] border border-[#A2DCE7]'
                : 'text-fg-muted hover:bg-surface-hover border border-transparent'
            }`}
          >
            {s === 'all' ? 'Todos' : s === 'open' ? 'Abiertos' : 'Cerrados'}
          </button>
        ))}
        <span className="ml-auto text-xs text-fg-subtle">{total} turno{total !== 1 ? 's' : ''}</span>
      </div>

      <div className="flex-1 overflow-auto p-5">
        {error && (
          <div className="mb-4 rounded-[4px] bg-danger-bg border border-danger px-4 py-3 text-sm text-danger">{error}</div>
        )}

        {rows === null ? (
          <div className="flex items-center justify-center h-40 text-sm text-fg-subtle">Cargando…</div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-fg-subtle">
            No hay turnos registrados.
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-[4px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-muted border-b border-border">
                  {['Apertura', 'Cierre', 'Cajero', 'Efectivo inicial', 'Esperado', 'Declarado', 'Diferencia', 'Estado'].map(h => (
                    <th
                      key={h}
                      className={`text-[11px] font-semibold text-fg-subtle px-3.5 py-2.5 uppercase tracking-[0.03em] ${
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
                    <tr key={row.id} className="border-b border-border last:border-0 hover:bg-surface-muted transition-colors">
                      <td className="font-mono text-[12px] px-3.5 py-2.5 text-fg-muted">{fmtDatetime(row.opened_at)}</td>
                      <td className="font-mono text-[12px] px-3.5 py-2.5 text-fg-muted">
                        {row.closed_at ? fmtDatetime(row.closed_at) : '—'}
                      </td>
                      <td className="text-[13px] px-3.5 py-2.5 text-fg">{row.cashier_name ?? '—'}</td>
                      <td className="font-mono text-[12px] px-3.5 py-2.5 text-right text-fg-muted">{ars(row.opening_amount)}</td>
                      <td className="font-mono text-[12px] px-3.5 py-2.5 text-right text-fg-muted">{ars(row.closing_amount_expected)}</td>
                      <td className="font-mono text-[12px] px-3.5 py-2.5 text-right text-fg-muted">{ars(row.closing_amount_declared)}</td>
                      <td className={`font-mono text-[12px] px-3.5 py-2.5 text-right font-medium ${
                        diff === null ? 'text-fg-subtle' : diff === 0 ? 'text-fg-muted' : diff > 0 ? 'text-success' : 'text-danger'
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
              <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-muted">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="text-xs px-3 py-1.5 rounded border border-border text-fg-muted hover:bg-surface disabled:opacity-40 transition-colors"
                >
                  Anterior
                </button>
                <span className="text-xs text-fg-muted">Página {page} de {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="text-xs px-3 py-1.5 rounded border border-border text-fg-muted hover:bg-surface disabled:opacity-40 transition-colors"
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
