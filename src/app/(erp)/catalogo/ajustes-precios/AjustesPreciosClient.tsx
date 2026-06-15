'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { CatalogoSubNav } from '../CatalogoSubNav'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifyApiError, notifySuccess } from '@/lib/notify'

type Category = { id: string; name: string }
type PriceList = { id: string; name: string; is_default: boolean }
type PreviewRow = { variant_id: string; sku: string; current_price: string; new_price: string }
type PreviewResult = { affected_count: number; sample: PreviewRow[]; updated_count?: number }

const ADJUSTMENT_OPTIONS = [
  { value: 'percent_increase', label: 'Aumento porcentual (%)' },
  { value: 'percent_decrease', label: 'Descuento porcentual (%)' },
  { value: 'fixed_increase', label: 'Aumento fijo ($)' },
  { value: 'fixed_decrease', label: 'Descuento fijo ($)' },
  { value: 'set', label: 'Establecer precio fijo ($)' },
] as const

function formatMoney(val: string) {
  const n = Number(val)
  if (Number.isNaN(n)) return val
  return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
}

export function AjustesPreciosClient() {
  const [categories, setCategories] = useState<Category[]>([])
  const [priceLists, setPriceLists] = useState<PriceList[]>([])
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)

  const [form, setForm] = useState({
    target: 'base_price' as 'base_price' | 'price_list',
    price_list_id: '',
    category_id: '',
    adjustment_type: 'percent_increase' as typeof ADJUSTMENT_OPTIONS[number]['value'],
    value: '',
  })

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const [cats, lists] = await Promise.all([
          fetchJson<{ data: Category[] }>('/api/v1/catalog/categories?limit=100'),
          fetchJson<{ data: PriceList[] }>('/api/v1/catalog/price-lists?limit=100&is_active=true'),
        ])
        if (!mounted) return
        setCategories(cats.data)
        setPriceLists(lists.data)
        const defaultList = lists.data.find(l => l.is_default)
        if (defaultList) setForm(f => ({ ...f, price_list_id: defaultList.id }))
      } catch (e) {
        if (mounted) notifyApiError(e)
      }
    })()
    return () => { mounted = false }
  }, [refresh])

  function buildPayload(dryRun: boolean) {
    return {
      target: form.target,
      price_list_id: form.target === 'price_list' ? form.price_list_id : undefined,
      category_id: form.category_id || undefined,
      adjustment_type: form.adjustment_type,
      value: form.value,
      dry_run: dryRun,
    }
  }

  async function handlePreview(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setServerError(null)
    setPreview(null)
    try {
      const result = await fetchJson<PreviewResult>('/api/v1/catalog/price-adjustments', {
        method: 'POST',
        body: JSON.stringify(buildPayload(true)),
      })
      setPreview(result)
    } catch (err) {
      setServerError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleApply() {
    setLoading(true)
    setServerError(null)
    try {
      const result = await fetchJson<PreviewResult>('/api/v1/catalog/price-adjustments', {
        method: 'POST',
        body: JSON.stringify(buildPayload(false)),
      })
      setPreview(result)
      setConfirmOpen(false)
      notifySuccess(`${result.updated_count ?? 0} precios actualizados`)
      setRefresh(r => r + 1)
    } catch (err) {
      setServerError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Catálogo', href: '/catalogo/productos' },
          { label: 'Ajustes de precios' },
        ]}
      />
      <CatalogoSubNav />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-4">
          <div className="bg-surface border border-border rounded-sm p-5">
            <h2 className="text-sm font-semibold text-fg mb-1">Ajuste masivo de precios</h2>
            <p className="text-xs text-fg-muted mb-4">
              Aplicá cambios por categoría, porcentaje o monto fijo sobre el precio base o una lista de precios.
            </p>

            <form onSubmit={handlePreview} className="space-y-4">
              {serverError && (
                <div className="text-xs text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">{serverError}</div>
              )}

              <FormField label="Canal / destino" htmlFor="target">
                <Select
                  id="target"
                  value={form.target}
                  onChange={(v) => setForm(f => ({ ...f, target: v as 'base_price' | 'price_list' }))}
                  options={[
                    { value: 'base_price', label: 'Precio base (variantes)' },
                    { value: 'price_list', label: 'Lista de precios' },
                  ]}
                />
              </FormField>

              {form.target === 'price_list' && (
                <FormField label="Lista de precios" htmlFor="price_list_id" required>
                  <Select
                    id="price_list_id"
                    value={form.price_list_id}
                    onChange={(v) => setForm(f => ({ ...f, price_list_id: v }))}
                    options={priceLists.map(l => ({ value: l.id, label: l.name + (l.is_default ? ' (predeterminada)' : '') }))}
                  />
                </FormField>
              )}

              <FormField label="Categoría" htmlFor="category_id">
                <Select
                  id="category_id"
                  value={form.category_id}
                  onChange={(v) => setForm(f => ({ ...f, category_id: v }))}
                  options={[
                    { value: '', label: 'Todas las categorías' },
                    ...categories.map(c => ({ value: c.id, label: c.name })),
                  ]}
                />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Tipo de ajuste" htmlFor="adjustment_type">
                  <Select
                    id="adjustment_type"
                    value={form.adjustment_type}
                    onChange={(v) => setForm(f => ({ ...f, adjustment_type: v as typeof form.adjustment_type }))}
                    options={ADJUSTMENT_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                  />
                </FormField>
                <FormField label="Valor" htmlFor="value" required>
                  <Input
                    id="value"
                    value={form.value}
                    onChange={(e) => setForm(f => ({ ...f, value: e.target.value }))}
                    placeholder={form.adjustment_type.startsWith('percent') ? '10' : '1500.00'}
                  />
                </FormField>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" variant="secondary" disabled={loading || !form.value}>
                  {loading ? 'Calculando…' : 'Vista previa'}
                </Button>
                <Button
                  type="button"
                  disabled={loading || !preview || preview.affected_count === 0}
                  onClick={() => setConfirmOpen(true)}
                >
                  Aplicar ajuste
                </Button>
              </div>
            </form>
          </div>

          {preview && (
            <div className="bg-surface border border-border rounded-sm">
              <div className="px-4 py-3 border-b border-border">
                <span className="text-[13px] font-semibold text-fg">
                  {preview.updated_count != null && preview.updated_count > 0
                    ? `${preview.updated_count} precios actualizados`
                    : `${preview.affected_count} variantes afectadas`}
                </span>
              </div>
              {preview.sample.length > 0 ? (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-fg-muted border-b border-border">
                      <th className="px-4 py-2">SKU</th>
                      <th className="px-4 py-2 text-right">Actual</th>
                      <th className="px-4 py-2 text-right">Nuevo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample.map(row => (
                      <tr key={row.variant_id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2 font-mono text-xs">{row.sku}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-fg-muted">{formatMoney(row.current_price)}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-medium text-fg">{formatMoney(row.new_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-6 text-sm text-fg-subtle text-center">Ninguna variante coincide con los filtros</div>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirmar ajuste masivo"
        description={`Se actualizarán ${preview?.affected_count ?? 0} precios. Esta acción no se puede deshacer automáticamente.`}
        confirmLabel="Aplicar"
        variant="warning"
        onConfirm={handleApply}
      />
    </div>
  )
}
