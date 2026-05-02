'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/primitives/Button'
import { InventarioSubNav } from '../InventarioSubNav'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

interface ReplenishmentRow {
  stock_item_id: string
  variant_id: string
  sku: string | null
  product_name: string
  variant_name: string | null
  warehouse_id: string
  warehouse_name: string
  quantity: string
  minimum_quantity: string
  suggested_qty: string
}

function exportCsv(rows: ReplenishmentRow[]) {
  const header = ['SKU', 'Producto', 'Variante', 'Depósito', 'Stock actual', 'Stock mínimo', 'Cantidad a pedir']
  const lines = rows.map(r => [
    r.sku ?? '',
    r.product_name,
    r.variant_name ?? '',
    r.warehouse_name,
    r.quantity,
    r.minimum_quantity,
    r.suggested_qty,
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  const csv = [header.join(','), ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `reposicion-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function ReposicionClient() {
  const [rows, setRows] = useState<ReplenishmentRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load
    setRows(null)
    setError(null)
    ;(async () => {
      try {
        const data = await fetchJson<{ data: ReplenishmentRow[] }>('/api/v1/inventory/stock/replenishment')
        setRows(data.data ?? [])
      } catch (e) {
        setError(getApiErrorMessage(e))
        setRows([])
      }
    })()
  }, [])

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Inventario' }, { label: 'Reposición' }]}
        actions={
          rows && rows.length > 0 ? (
            <Button variant="secondary" size="sm" onClick={() => exportCsv(rows)}>
              Exportar CSV
            </Button>
          ) : null
        }
      />
      <InventarioSubNav />
      <div className="flex-1 overflow-auto p-5">
        {error && (
          <div className="mb-4 rounded-[4px] bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {rows === null ? (
          <div className="flex items-center justify-center h-40 text-sm text-zinc-400">Cargando…</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <p className="text-sm text-zinc-500">No hay productos por reponer. Todo el stock está sobre el mínimo.</p>
          </div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-[4px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200">
                  {['SKU', 'Producto', 'Depósito', 'Stock actual', 'Mínimo', 'A pedir'].map(h => (
                    <th
                      key={h}
                      className={`text-[11px] font-semibold text-zinc-400 px-3.5 py-2.5 uppercase tracking-[0.03em] ${
                        ['Stock actual', 'Mínimo', 'A pedir'].includes(h) ? 'text-right' : 'text-left'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.stock_item_id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50 transition-colors">
                    <td className="font-mono text-[12px] px-3.5 py-2.5 text-zinc-500">{row.sku ?? '—'}</td>
                    <td className="text-[13px] px-3.5 py-2.5 text-zinc-900">
                      {row.product_name}
                      {row.variant_name && (
                        <span className="ml-1.5 text-[11px] text-zinc-400">{row.variant_name}</span>
                      )}
                    </td>
                    <td className="text-[13px] px-3.5 py-2.5 text-zinc-600">{row.warehouse_name}</td>
                    <td className="font-mono text-[13px] px-3.5 py-2.5 text-right text-red-600 font-medium">{row.quantity}</td>
                    <td className="font-mono text-[13px] px-3.5 py-2.5 text-right text-zinc-500">{row.minimum_quantity}</td>
                    <td className="font-mono text-[13px] px-3.5 py-2.5 text-right text-zinc-900 font-semibold">{row.suggested_qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
