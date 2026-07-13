'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Textarea } from '@/components/primitives/Textarea'
import { DatePicker } from '@/components/primitives/DatePicker'
import { SearchableSelect } from '@/components/erp/SearchableSelect'
import type { SearchableSelectOption } from '@/components/erp/SearchableSelect'
import { BranchSelectField } from '@/components/erp/BranchSelectField'
import { useBranchDefaultWarehouse } from '@/components/erp/useBranchDefaultWarehouse'
import { ProduccionSubNav } from '../../ProduccionSubNav'
import type { Bom } from '../../types'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

type ProductRow = {
  id: string
  name: string
  production_type?: string | null
  variants: Array<{ id: string; sku: string; name: string | null; is_default: boolean }>
}

export function NuevaOrdenClient() {
  const router = useRouter()

  const [branchId, setBranchId] = useState<string | null>(null)
  const { warehouseId, setWarehouseId, warehouseOptions, searchWarehouses } = useBranchDefaultWarehouse(branchId)

  const [variantId, setVariantId] = useState<string | null>(null)
  const [plannedQuantity, setPlannedQuantity] = useState('1')
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null)
  const [notes, setNotes] = useState('')

  const [bom, setBom] = useState<Bom | null>(null)
  const [bomLoading, setBomLoading] = useState(false)

  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const searchFinishedProducts = useCallback(async (q: string): Promise<SearchableSelectOption[]> => {
    try {
      const data = await fetchJson<{ data: ProductRow[] }>(
        `/api/v1/catalog/products?search=${encodeURIComponent(q)}&limit=20&production_type=producto_terminado`,
      )
      return (data.data ?? []).flatMap(p => {
        const variant = p.variants?.find(v => v.is_default) ?? p.variants?.[0]
        if (!variant) return []
        return [{ value: variant.id, label: p.name, sublabel: variant.sku }]
      })
    } catch {
      return []
    }
  }, [])

  useEffect(() => {
    if (!variantId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset preview when the product is cleared
      setBom(null)
      return
    }
    let cancelled = false
    setBomLoading(true)
    ;(async () => {
      try {
        const data = await fetchJson<{ data: Bom[] }>(
          `/api/v1/production/boms?variant_id=${encodeURIComponent(variantId)}&is_active=true&limit=1`,
        )
        if (!cancelled) setBom(data.data?.[0] ?? null)
      } catch {
        if (!cancelled) setBom(null)
      } finally {
        if (!cancelled) setBomLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [variantId])

  const scale = bom ? (parseFloat(plannedQuantity || '0') || 0) / (parseFloat(bom.output_quantity) || 1) : 0

  async function handleSave() {
    if (!branchId) { setServerError('Elegí una sucursal.'); return }
    if (!variantId) { setServerError('Elegí el producto terminado a fabricar.'); return }
    if (!bom) { setServerError('El producto elegido no tiene una receta (BOM) activa.'); return }

    setSaving(true)
    setServerError(null)

    const body = {
      branch_id:        branchId,
      warehouse_id:      warehouseId,
      variant_id:        variantId,
      planned_quantity:  parseFloat(plannedQuantity) || 1,
      scheduled_date:    scheduledDate ? scheduledDate.toISOString().slice(0, 10) : null,
      notes:             notes.trim() || null,
    }

    try {
      const order = await fetchJson<{ id: string }>('/api/v1/production/orders', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      router.push(`/produccion/ordenes/${order.id}`)
    } catch (e) {
      setServerError(getApiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Órdenes de producción', href: '/produccion/ordenes' },
          { label: 'Nueva orden' },
        ]}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => router.push('/produccion/ordenes')}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando…' : 'Crear orden'}
            </Button>
          </div>
        }
      />
      <ProduccionSubNav />

      <PageBody>
        <div className="max-w-3xl mx-auto flex flex-col gap-5">

          {serverError && (
            <div className="px-4 py-2 bg-danger-bg border border-danger rounded-sm text-sm text-danger">
              {serverError}
            </div>
          )}

          <div className="bg-surface border border-border rounded-sm p-5 flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Sucursal" required>
                <BranchSelectField value={branchId} onChange={setBranchId} />
              </FormField>

              <FormField label="Depósito" required>
                <SearchableSelect
                  value={warehouseId}
                  onChange={setWarehouseId}
                  options={warehouseOptions}
                  onSearch={searchWarehouses}
                  placeholder={branchId ? 'Buscar depósito…' : 'Elegí primero una sucursal'}
                  disabled={!branchId}
                />
              </FormField>

              <FormField label="Producto terminado a fabricar" required>
                <SearchableSelect
                  value={variantId}
                  onChange={setVariantId}
                  onSearch={searchFinishedProducts}
                  placeholder="Buscar producto…"
                />
              </FormField>

              <FormField label="Cantidad planificada" required>
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={plannedQuantity}
                  onChange={e => setPlannedQuantity(e.target.value)}
                  className="w-full h-9 px-3 text-sm border border-border rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </FormField>

              <FormField label="Fecha programada">
                <DatePicker value={scheduledDate} onChange={setScheduledDate} />
              </FormField>
            </div>
          </div>

          {variantId && (
            <div className="bg-surface border border-border rounded-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <p className="text-[12px] font-semibold text-fg-muted uppercase tracking-wide">Consumo previsto (según receta)</p>
              </div>
              {bomLoading ? (
                <p className="px-5 py-4 text-[13px] text-fg-subtle">Cargando receta…</p>
              ) : !bom ? (
                <p className="px-5 py-4 text-[13px] text-danger">
                  Este producto no tiene una receta (BOM) activa. Creá una en{' '}
                  <span className="underline">Producción → Recetas</span> antes de generar la orden.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-surface-muted border-b border-border">
                    <tr>
                      <th className="text-left px-4 py-2 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Insumo</th>
                      <th className="text-right px-4 py-2 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Cant. x unidad</th>
                      <th className="text-right px-4 py-2 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Merma</th>
                      <th className="text-right px-4 py-2 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">A consumir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {bom.items.map(item => {
                      const qty = (parseFloat(item.quantity) || 0) * (1 + (parseFloat(item.scrap_pct) || 0) / 100) * scale
                      return (
                        <tr key={item.id}>
                          <td className="px-4 py-2.5 text-fg">
                            {item.component?.product?.name ?? item.component?.name ?? item.component?.sku ?? '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">{item.quantity}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-fg-muted">{item.scrap_pct}%</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-medium">{qty.toLocaleString('es-AR', { maximumFractionDigits: 4 })}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          <div className="bg-surface border border-border rounded-sm p-5">
            <FormField label="Notas">
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Notas de la orden…" />
            </FormField>
          </div>

        </div>
      </PageBody>
    </div>
  )
}
