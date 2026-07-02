'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { FormField } from '@/components/primitives/FormField'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { fetchJson, getApiErrorMessage, isApiRequestError } from '@/lib/fetch-json'
import { fieldErrorsFromApiError } from '@/lib/validation-errors'

type Variant = {
  id: string
  sku: string
  name: string | null
  base_price: string | null
  cost_price: string | null
  barcode: string | null
  manage_stock: boolean
  allow_backorder: boolean
  stock_quantity: number
  is_default: boolean
  weight_kg: string | null
  length_cm: string | null
  width_cm: string | null
  height_cm: string | null
  units_per_package: number | null
}

type FieldErrors = Record<string, string[]>

function formatMoney(val: string | null) {
  if (!val) return '—'
  const n = Number(val)
  if (Number.isNaN(n)) return val
  return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
}

export function VariantsSectionClient({
  productId,
  productName,
  variants,
}: {
  productId: string
  productName: string
  variants: Variant[]
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<Variant | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Variant | null>(null)

  const rows = useMemo(() => {
    return variants
      .slice()
      .sort((a, b) => {
        const da = a.is_default ? 0 : 1
        const db = b.is_default ? 0 : 1
        if (da !== db) return da - db
        const an = (a.name ?? '').toLowerCase()
        const bn = (b.name ?? '').toLowerCase()
        if (an !== bn) return an.localeCompare(bn)
        return a.sku.localeCompare(b.sku)
      })
  }, [variants])

  async function handleDeleteVariant(id: string) {
    try {
      await fetchJson(`/api/v1/catalog/product-variants/${id}`, { method: 'DELETE' })
      setDeleting(null)
      router.refresh()
    } catch (e) {
      setDeleting(null)
      // keep it simple: show generic error
      alert(getApiErrorMessage(e))
    }
  }

  return (
    <div className="bg-surface border border-border rounded-sm">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider">Variantes</span>
        <Button size="xs" variant="secondary" onClick={() => setCreating(true)}>
          + Nueva variante
        </Button>
      </div>

      <div className="p-4">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-fg-muted">
                <th className="py-2 pr-3">Variante</th>
                <th className="py-2 pr-3">SKU</th>
                <th className="py-2 pr-3 text-right">Precio</th>
                <th className="py-2 pr-3 text-right">Stock</th>
                <th className="py-2 pr-3">Logística</th>
                <th className="py-2 pr-0 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id} className="border-t border-border">
                  <td className="py-2 pr-3 text-fg">
                    <div className="flex items-center gap-2">
                      <span>{v.name ?? (v.is_default ? productName : 'Variante')}</span>
                      {v.is_default && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-hover text-fg-muted border border-border">
                          default
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs text-fg-muted">{v.sku}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-fg-muted">{formatMoney(v.base_price)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-fg-muted">{v.manage_stock ? v.stock_quantity : '—'}</td>
                  <td className="py-2 pr-3 text-xs text-fg-muted">
                    {v.weight_kg ? `${v.weight_kg} kg` : '—'}
                    {v.length_cm && v.width_cm && v.height_cm
                      ? ` · ${v.length_cm}×${v.width_cm}×${v.height_cm} cm`
                      : ''}
                    {v.units_per_package ? ` · ${v.units_per_package} u/bulto` : ''}
                  </td>
                  <td className="py-2 pr-0 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        className="text-brand-700 hover:text-brand-800 text-[12px] font-medium"
                        onClick={() => setEditing(v)}
                        type="button"
                      >
                        Editar
                      </button>
                      <button
                        className="text-danger hover:text-danger text-[12px] font-medium"
                        onClick={() => setDeleting(v)}
                        type="button"
                        disabled={v.is_default}
                        title={v.is_default ? 'No se puede eliminar la variante default' : undefined}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-fg-subtle">
                    Sin variantes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(creating || editing) && (
        <VariantModal
          productId={productId}
          initial={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={() => {
            setCreating(false)
            setEditing(null)
            router.refresh()
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => { if (!open) setDeleting(null) }}
        title="Eliminar variante"
        description={deleting ? `Se eliminará ${deleting.name ?? deleting.sku}.` : ''}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => {
          if (!deleting) return
          return handleDeleteVariant(deleting.id)
        }}
      />
    </div>
  )
}

function VariantModal({
  productId,
  initial,
  onClose,
  onSaved,
}: {
  productId: string
  initial: Variant | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: initial?.name ?? '',
    sku: initial?.sku ?? '',
    barcode: initial?.barcode ?? '',
    base_price: initial?.base_price ?? '',
    cost_price: initial?.cost_price ?? '',
    manage_stock: initial?.manage_stock ?? true,
    allow_backorder: initial?.allow_backorder ?? false,
    stock_quantity: initial?.stock_quantity ?? 0,
    weight_kg: initial?.weight_kg ?? '',
    length_cm: initial?.length_cm ?? '',
    width_cm: initial?.width_cm ?? '',
    height_cm: initial?.height_cm ?? '',
    units_per_package: initial?.units_per_package != null ? String(initial.units_per_package) : '',
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    setServerError(null)

    const body = {
      ...(isEdit ? {} : { product_id: productId }),
      name: form.name ? form.name : null,
      sku: form.sku,
      barcode: form.barcode ? form.barcode : null,
      base_price: form.base_price ? form.base_price : null,
      cost_price: form.cost_price ? form.cost_price : null,
      manage_stock: form.manage_stock,
      allow_backorder: form.manage_stock ? form.allow_backorder : false,
      stock_quantity: form.stock_quantity,
      weight_kg: form.weight_kg ? form.weight_kg : null,
      length_cm: form.length_cm ? form.length_cm : null,
      width_cm: form.width_cm ? form.width_cm : null,
      height_cm: form.height_cm ? form.height_cm : null,
      units_per_package: form.units_per_package ? Number.parseInt(form.units_per_package, 10) : null,
    }

    try {
      if (isEdit) {
        await fetchJson(`/api/v1/catalog/product-variants/${initial!.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      } else {
        await fetchJson('/api/v1/catalog/product-variants', { method: 'POST', body: JSON.stringify(body) })
      }
      onSaved()
    } catch (err) {
      const fe = fieldErrorsFromApiError(err)
      if (fe) {
        setErrors(fe)
        return
      }
      if (isApiRequestError(err) && err.code === 'DUPLICATE_SKU') {
        setServerError('El SKU ya existe para otra variante.')
        return
      }
      setServerError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" aria-hidden onClick={onClose} />
      <form
        onSubmit={submit}
        className="relative bg-surface rounded-sm border border-border shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-fg">{isEdit ? 'Editar variante' : 'Nueva variante'}</h2>
          <button type="button" onClick={onClose} className="text-fg-subtle hover:text-fg-muted text-lg leading-none">×</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {serverError && (
            <div className="text-xs text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">{serverError}</div>
          )}

          <FormField label="Nombre" htmlFor="variant_name" error={errors.name?.[0]}>
            <Input id="variant_name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </FormField>

          <FormField label="SKU *" htmlFor="variant_sku" error={errors.sku?.[0]} required>
            <Input id="variant_sku" value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} error={!!errors.sku?.[0]} />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Precio base" htmlFor="variant_base_price" error={errors.base_price?.[0]}>
              <Input id="variant_base_price" value={form.base_price} onChange={(e) => setForm((f) => ({ ...f, base_price: e.target.value }))} />
            </FormField>
            <FormField label="Costo" htmlFor="variant_cost_price" error={errors.cost_price?.[0]}>
              <Input id="variant_cost_price" value={form.cost_price} onChange={(e) => setForm((f) => ({ ...f, cost_price: e.target.value }))} />
            </FormField>
          </div>

          <FormField label="Código de barras" htmlFor="variant_barcode" error={errors.barcode?.[0]}>
            <Input id="variant_barcode" value={form.barcode} onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))} />
          </FormField>

          <div className="border-t border-border pt-3">
            <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">Logística</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Peso (kg)" htmlFor="variant_weight" error={errors.weight_kg?.[0]}>
                <Input id="variant_weight" value={form.weight_kg} onChange={(e) => setForm((f) => ({ ...f, weight_kg: e.target.value }))} />
              </FormField>
              <FormField label="Unidades por bulto" htmlFor="variant_units_pkg" error={errors.units_per_package?.[0]}>
                <Input id="variant_units_pkg" type="number" min={1} value={form.units_per_package} onChange={(e) => setForm((f) => ({ ...f, units_per_package: e.target.value }))} />
              </FormField>
              <FormField label="Largo (cm)" htmlFor="variant_length" error={errors.length_cm?.[0]}>
                <Input id="variant_length" value={form.length_cm} onChange={(e) => setForm((f) => ({ ...f, length_cm: e.target.value }))} />
              </FormField>
              <FormField label="Ancho (cm)" htmlFor="variant_width" error={errors.width_cm?.[0]}>
                <Input id="variant_width" value={form.width_cm} onChange={(e) => setForm((f) => ({ ...f, width_cm: e.target.value }))} />
              </FormField>
              <FormField label="Alto (cm)" htmlFor="variant_height" error={errors.height_cm?.[0]}>
                <Input id="variant_height" value={form.height_cm} onChange={(e) => setForm((f) => ({ ...f, height_cm: e.target.value }))} />
              </FormField>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Gestiona stock" htmlFor="variant_manage_stock" error={errors.manage_stock?.[0]}>
              <select
                id="variant_manage_stock"
                value={form.manage_stock ? '1' : '0'}
                onChange={(e) => setForm((f) => ({
                  ...f,
                  manage_stock: e.target.value === '1',
                  allow_backorder: e.target.value === '1' ? f.allow_backorder : false,
                }))}
                className="h-8 w-full px-2 text-sm border border-border-strong rounded-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="1">Sí</option>
                <option value="0">No</option>
              </select>
            </FormField>
            {form.manage_stock && (
              <label className="flex items-center gap-2 text-sm text-fg-muted cursor-pointer sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.allow_backorder}
                  onChange={(e) => setForm((f) => ({ ...f, allow_backorder: e.target.checked }))}
                  className="accent-brand-600"
                />
                Permitir reservas (vender sin stock)
              </label>
            )}
            <FormField label="Stock" htmlFor="variant_stock" error={errors.stock_quantity?.[0]}>
              <Input
                id="variant_stock"
                type="number"
                value={String(form.stock_quantity)}
                onChange={(e) => setForm((f) => ({ ...f, stock_quantity: Number.parseInt(e.target.value || '0', 10) }))}
              />
            </FormField>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-surface-muted">
          <Button variant="secondary" size="sm" type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </div>
  )
}

