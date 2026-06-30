'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { Button } from '@/components/primitives/Button'
import { InventoryStockHint } from '@/components/erp/InventoryStockHint'
import { InventarioSubNav } from '../InventarioSubNav'
import { savePurchaseOrderDraft } from '@/lib/purchase-order-draft'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

interface ReplenishmentRow {
  stock_item_id: string
  variant_id: string
  product_id: string | null
  sku: string | null
  product_name: string
  variant_name: string | null
  warehouse_id: string
  warehouse_name: string
  quantity: string
  minimum_quantity: string
  suggested_qty: string
}

interface ReplenishmentMeta {
  below_minimum_count: number
  items_with_minimum: number
  total_stock_items: number
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

function lineDescription(row: ReplenishmentRow): string {
  if (row.variant_name && row.variant_name !== row.product_name) {
    return `${row.product_name} — ${row.variant_name}`
  }
  return row.product_name
}

export function ReposicionClient() {
  const router = useRouter()
  const [rows, setRows] = useState<ReplenishmentRow[] | null>(null)
  const [meta, setMeta] = useState<ReplenishmentMeta | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load
    setRows(null)
    setMeta(null)
    setError(null)
    ;(async () => {
      try {
        const data = await fetchJson<{ data: ReplenishmentRow[]; meta: ReplenishmentMeta }>(
          '/api/v1/inventory/stock/replenishment',
        )
        setRows(data.data ?? [])
        setMeta(data.meta ?? null)
      } catch (e) {
        setError(getApiErrorMessage(e))
        setRows([])
      }
    })()
  }, [])

  function createPurchaseOrder() {
    if (!rows?.length) return
    savePurchaseOrderDraft({
      source: 'replenishment',
      notes: 'Generada desde reposición de inventario',
      items: rows.map(row => ({
        product_id: row.product_id,
        variant_id: row.variant_id,
        description: lineDescription(row),
        quantity: row.suggested_qty,
      })),
    })
    router.push('/compras/ordenes/nueva')
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Inventario' }, { label: 'Reposición' }]}
        actions={
          rows && rows.length > 0 ? (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => exportCsv(rows)}>
                Exportar CSV
              </Button>
              <Button size="sm" onClick={createPurchaseOrder}>
                Crear orden de compra
              </Button>
            </div>
          ) : null
        }
      />
      <InventarioSubNav />
      <PageBody className="flex flex-col gap-5">
        <InventoryStockHint screen="reposicion" />

        {error && (
          <div className="mb-4 rounded-[4px] bg-danger-bg border border-danger px-4 py-3 text-sm text-danger">{error}</div>
        )}

        {rows === null ? (
          <div className="flex items-center justify-center h-40 text-sm text-fg-subtle">Cargando…</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center max-w-md mx-auto">
            {meta && meta.items_with_minimum === 0 ? (
              <>
                <p className="text-sm font-medium text-fg">Sin mínimos configurados</p>
                <p className="text-[13px] text-fg-muted">
                  Ningún producto tiene stock mínimo en un depósito. Entrá al detalle de un depósito y usá{' '}
                  <strong>Stock y alertas</strong> para definir el mínimo por producto.
                </p>
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/inventario/depositos">Ir a depósitos</Link>
                </Button>
              </>
            ) : (
              <>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <p className="text-sm font-medium text-fg">Todo sobre el mínimo</p>
                <p className="text-[13px] text-fg-muted">
                  Hay {meta?.items_with_minimum ?? 0} producto(s) con mínimo configurado y ninguno está bajo ese umbral.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-[4px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-muted border-b border-border">
                  {['SKU', 'Producto', 'Depósito', 'Stock actual', 'Mínimo', 'A pedir'].map(h => (
                    <th
                      key={h}
                      className={`text-[11px] font-semibold text-fg-subtle px-3.5 py-2.5 uppercase tracking-[0.03em] ${
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
                  <tr key={row.stock_item_id} className="border-b border-border last:border-0 hover:bg-surface-muted transition-colors">
                    <td className="font-mono text-[12px] px-3.5 py-2.5 text-fg-muted">{row.sku ?? '—'}</td>
                    <td className="text-[13px] px-3.5 py-2.5 text-fg">
                      {row.product_name}
                      {row.variant_name && (
                        <span className="ml-1.5 text-[11px] text-fg-subtle">{row.variant_name}</span>
                      )}
                    </td>
                    <td className="text-[13px] px-3.5 py-2.5 text-fg-muted">{row.warehouse_name}</td>
                    <td className="font-mono text-[13px] px-3.5 py-2.5 text-right text-danger font-medium">{row.quantity}</td>
                    <td className="font-mono text-[13px] px-3.5 py-2.5 text-right text-fg-muted">{row.minimum_quantity}</td>
                    <td className="font-mono text-[13px] px-3.5 py-2.5 text-right text-fg font-semibold">{row.suggested_qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageBody>
    </div>
  )
}
