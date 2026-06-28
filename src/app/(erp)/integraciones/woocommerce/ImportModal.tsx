'use client'

import { useState } from 'react'
import { Dialog } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { Switch } from '@/components/primitives/Switch'
import { Select } from '@/components/primitives/Select'
import { FormField } from '@/components/primitives/FormField'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import type { WooSiteRow, ImportPreview } from './types'

interface ImportModalProps {
  open: boolean
  site: WooSiteRow | null
  onClose: () => void
  onApplied: () => void
}

function ImportBody({ site, onClose, onApplied }: { site: WooSiteRow; onClose: () => void; onApplied: () => void }) {
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const [importUnmatched, setImportUnmatched] = useState(true)
  const [importOrders, setImportOrders] = useState(true)
  const [openOrdersOnly, setOpenOrdersOnly] = useState(true)
  const [baseline, setBaseline] = useState('none')

  async function runPreview() {
    setLoading(true); setError(null); setResult(null)
    try {
      setPreview(await fetchJson<ImportPreview>(`/api/v1/integrations/woocommerce/sites/${site.id}/import/preview`, { method: 'POST' }))
    } catch (err) { setError(getApiErrorMessage(err)) } finally { setLoading(false) }
  }

  async function runApply() {
    setLoading(true); setError(null)
    try {
      const res = await fetchJson<{ products_linked: number; products_imported: number; orders_imported: number }>(
        `/api/v1/integrations/woocommerce/sites/${site.id}/import/apply`,
        {
          method: 'POST',
          body: JSON.stringify({
            import_unmatched_products: importUnmatched,
            import_orders: importOrders,
            open_orders_only: openOrdersOnly,
            stock_baseline: baseline,
          }),
        },
      )
      setResult(`Vinculados ${res.products_linked} · Importados ${res.products_imported} · Pedidos ${res.orders_imported}`)
      onApplied()
    } catch (err) { setError(getApiErrorMessage(err)) } finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-fg-muted">
        Reconcilia los productos y pedidos existentes en WooCommerce. La vista previa no escribe nada.
      </p>

      <Button type="button" size="sm" variant="secondary" onClick={runPreview} disabled={loading}>
        {loading ? 'Procesando…' : 'Vista previa'}
      </Button>

      {preview && (
        <div className="text-[13px] border border-border rounded-sm p-3 flex flex-col gap-1">
          <div>Total en WooCommerce: <strong>{preview.woo_total}</strong></div>
          <div>Coinciden por SKU: <strong>{preview.matched.length}</strong></div>
          <div>A importar (solo en Woo): <strong>{preview.to_import.length}</strong></div>
          <div>Requieren mapeo manual: <strong>{preview.needs_mapping.length}</strong></div>
          {preview.needs_mapping.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-fg-muted">
              {preview.needs_mapping.slice(0, 10).map((m, i) => <li key={i}>{m.name} — {m.reason}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-border pt-3">
        <Switch checked={importUnmatched} onCheckedChange={setImportUnmatched} label="Importar productos que solo existen en WooCommerce" />
        <Switch checked={importOrders} onCheckedChange={setImportOrders} label="Importar pedidos" />
        <Switch checked={openOrdersOnly} onCheckedChange={setOpenOrdersOnly} label="Solo pedidos abiertos (no facturados)" />
        <FormField label="Stock inicial" htmlFor="woo_baseline">
          <Select
            id="woo_baseline"
            value={baseline}
            onChange={setBaseline}
            options={[
              { value: 'none', label: 'No tocar el stock' },
              { value: 'push_erp', label: 'Publicar stock del ERP a WooCommerce' },
              { value: 'seed_from_woo', label: 'Tomar el stock actual de WooCommerce como inicial' },
            ]}
          />
        </FormField>
      </div>

      {error && <p role="alert" className="text-[12px] text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">{error}</p>}
      {result && <p className="text-[12px] text-success bg-success-bg border border-success rounded-sm px-3 py-2">{result}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={loading}>Cerrar</Button>
        <Button type="button" size="sm" onClick={runApply} disabled={loading}>Aplicar importación</Button>
      </div>
    </div>
  )
}

export function ImportModal({ open, site, onClose, onApplied }: ImportModalProps) {
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }} title="Importar tienda existente" size="md">
      {open && site ? <ImportBody key={site.id} site={site} onClose={onClose} onApplied={onApplied} /> : null}
    </Dialog>
  )
}
