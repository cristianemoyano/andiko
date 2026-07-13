'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogFooter } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Textarea } from '@/components/primitives/Textarea'
import { SearchableSelect } from '@/components/erp/SearchableSelect'
import type { SearchableSelectOption } from '@/components/erp/SearchableSelect'
import type { Bom } from '../types'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

type ProductRow = {
  id: string
  name: string
  variants: Array<{ id: string; sku: string; name: string | null; is_default: boolean }>
}

type ItemRow = {
  key: string
  component_variant_id: string | null
  componentLabel: string
  quantity: string
  scrap_pct: string
}

function makeEmptyItem(): ItemRow {
  return { key: crypto.randomUUID(), component_variant_id: null, componentLabel: '', quantity: '1', scrap_pct: '0' }
}

interface BomModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bom: Bom | null
  onSaved: () => void
}

export function BomModal({ open, onOpenChange, bom, onSaved }: BomModalProps) {
  const isEdit = !!bom

  const [variantId, setVariantId]           = useState<string | null>(null)
  const [variantLabel, setVariantLabel]      = useState<string>('')
  const [name, setName]                      = useState('')
  const [outputQuantity, setOutputQuantity]  = useState('1')
  const [notes, setNotes]                    = useState('')
  const [items, setItems]                    = useState<ItemRow[]>([makeEmptyItem()])
  const [saving, setSaving]                  = useState(false)
  const [error, setError]                    = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (bom) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate form once when the dialog opens
      setVariantId(bom.variant_id)
      setVariantLabel(bom.variant?.product?.name ?? bom.variant?.name ?? bom.variant?.sku ?? '')
      setName(bom.name)
      setOutputQuantity(bom.output_quantity)
      setNotes(bom.notes ?? '')
      setItems(
        bom.items.length > 0
          ? bom.items.map(i => ({
              key: i.id,
              component_variant_id: i.component_variant_id,
              componentLabel: i.component?.product?.name ?? i.component?.name ?? i.component?.sku ?? '',
              quantity: i.quantity,
              scrap_pct: i.scrap_pct,
            }))
          : [makeEmptyItem()],
      )
    } else {
      setVariantId(null)
      setVariantLabel('')
      setName('')
      setOutputQuantity('1')
      setNotes('')
      setItems([makeEmptyItem()])
    }
    setError(null)
  }, [open, bom])

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

  const searchComponents = useCallback(async (q: string): Promise<SearchableSelectOption[]> => {
    try {
      const data = await fetchJson<{ data: ProductRow[] }>(
        `/api/v1/catalog/products?search=${encodeURIComponent(q)}&limit=20`,
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

  function updateItem(key: string, patch: Partial<ItemRow>) {
    setItems(prev => prev.map(i => i.key === key ? { ...i, ...patch } : i))
  }

  function removeItem(key: string) {
    setItems(prev => prev.length > 1 ? prev.filter(i => i.key !== key) : prev)
  }

  async function handleSave() {
    if (!isEdit && !variantId) { setError('Elegí el producto terminado.'); return }
    if (!name.trim()) { setError('Ingresá un nombre para la receta.'); return }
    const validItems = items.filter(i => i.component_variant_id)
    if (validItems.length === 0) { setError('Agregá al menos un componente.'); return }

    setSaving(true)
    setError(null)

    const itemsPayload = validItems.map((i, idx) => ({
      component_variant_id: i.component_variant_id,
      quantity:              parseFloat(i.quantity) || 0,
      scrap_pct:             parseFloat(i.scrap_pct) || 0,
      sort_order:            idx,
    }))

    try {
      if (isEdit && bom) {
        await fetchJson(`/api/v1/production/boms/${bom.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name:            name.trim(),
            output_quantity: parseFloat(outputQuantity) || 1,
            notes:           notes.trim() || null,
            items:           itemsPayload,
          }),
        })
      } else {
        await fetchJson('/api/v1/production/boms', {
          method: 'POST',
          body: JSON.stringify({
            variant_id:      variantId,
            name:            name.trim(),
            output_quantity: parseFloat(outputQuantity) || 1,
            notes:           notes.trim() || null,
            items:           itemsPayload,
          }),
        })
      }
      onSaved()
      onOpenChange(false)
    } catch (e) {
      setError(getApiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Editar receta' : 'Nueva receta'}
      description={isEdit ? 'Se creará una nueva versión activa; la anterior queda inactiva.' : undefined}
      size="lg"
      footer={
        <DialogFooter error={error}>
          <Button size="sm" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar receta'}
          </Button>
        </DialogFooter>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Producto terminado" required>
            {isEdit ? (
              <p className="text-[13px] text-fg py-1.5 px-3 bg-surface-muted border border-border rounded-sm">{variantLabel}</p>
            ) : (
              <SearchableSelect
                value={variantId}
                onChange={setVariantId}
                onSearch={searchFinishedProducts}
                placeholder="Buscar producto terminado…"
              />
            )}
          </FormField>

          <FormField label="Nombre de la receta" required>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full h-9 px-3 text-sm border border-border rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Ej. Receta estándar"
            />
          </FormField>

          <FormField label="Rinde (unidades por lote)" required>
            <input
              type="number"
              min="0.0001"
              step="0.0001"
              value={outputQuantity}
              onChange={e => setOutputQuantity(e.target.value)}
              className="w-full h-9 px-3 text-sm border border-border rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </FormField>
        </div>

        <div className="border border-border rounded-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted border-b border-border">
              <tr>
                <th className="text-left px-3 py-2 text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Componente</th>
                <th className="text-right px-3 py-2 text-[11px] font-semibold text-fg-muted uppercase tracking-wide w-28">Cantidad</th>
                <th className="text-right px-3 py-2 text-[11px] font-semibold text-fg-muted uppercase tracking-wide w-24">Merma %</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map(item => (
                <tr key={item.key}>
                  <td className="px-3 py-2">
                    <SearchableSelect
                      value={item.component_variant_id}
                      onChange={v => updateItem(item.key, { component_variant_id: v })}
                      onSearch={searchComponents}
                      placeholder="Buscar insumo…"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={item.quantity}
                      onChange={e => updateItem(item.key, { quantity: e.target.value })}
                      className="w-full h-8 px-2 text-[13px] text-right border border-border-strong rounded-sm bg-surface focus:outline-none focus:border-ring"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      max="99.99"
                      step="0.01"
                      value={item.scrap_pct}
                      onChange={e => updateItem(item.key, { scrap_pct: e.target.value })}
                      className="w-full h-8 px-2 text-[13px] text-right border border-border-strong rounded-sm bg-surface focus:outline-none focus:border-ring"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeItem(item.key)}
                      className="text-fg-subtle hover:text-danger"
                      aria-label="Quitar componente"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2 border-t border-border">
            <button
              type="button"
              onClick={() => setItems(prev => [...prev, makeEmptyItem()])}
              className="text-[12px] text-blue-600 hover:text-blue-700 font-medium"
            >
              + Agregar componente
            </button>
          </div>
        </div>

        <FormField label="Notas">
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Notas de la receta…" />
        </FormField>
      </div>
    </Dialog>
  )
}
