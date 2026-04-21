'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { FormField } from '@/components/primitives/FormField'

interface ProductModalProps {
  product?: {
    id: string
    name: string
    product_type: string
    status: string
    iva_rate: string
    unit_of_measure: string
    vendor: string | null
    category_id: string | null
    description: string | null
    variants: Array<{ sku: string; base_price: string | null; cost_price: string | null; barcode: string | null; manage_stock?: boolean; stock_quantity?: number }>
  } | null
  onClose: () => void
  onSaved: () => void
}

type FieldErrors = Record<string, string[]>

type Category = {
  id: string
  name: string
  status: 'active' | 'archived'
}

export function ProductModal({ product, onClose, onSaved }: ProductModalProps) {
  const isEdit = !!product
  const dialogRef = useRef<HTMLDialogElement>(null)
  const variant = product?.variants?.[0]
  const [tab, setTab] = useState<'general' | 'pricing'>('general')

  const [saving, setSaving]           = useState(false)
  const [errors, setErrors]           = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [categories, setCategories]   = useState<Category[]>([])
  const [loadingCategories, setLoadingCategories] = useState(false)

  const [form, setForm] = useState({
    name:            product?.name ?? '',
    product_type:    product?.product_type ?? 'simple',
    status:          product?.status ?? 'draft',
    iva_rate:        product?.iva_rate ?? '21',
    unit_of_measure: product?.unit_of_measure ?? 'unidad',
    vendor:          product?.vendor ?? '',
    category_id:     product?.category_id ?? '',
    description:     product?.description ?? '',
    sku:             variant?.sku ?? '',
    barcode:         variant?.barcode ?? '',
    base_price:      variant?.base_price ?? '',
    cost_price:      variant?.cost_price ?? '',
    manage_stock:    variant?.manage_stock ?? true,
    stock_quantity:  variant?.stock_quantity ?? 0,
  })

  function fieldString(key: Exclude<keyof typeof form, 'manage_stock' | 'stock_quantity'>) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setForm(f => ({ ...f, [key]: e.target.value })),
    }
  }

  async function safeJson(res: Response): Promise<unknown | null> {
    const text = await res.text()
    if (!text) return null
    try { return JSON.parse(text) } catch { return { error: text } }
  }

  useEffect(() => {
    let mounted = true
    async function loadCategories() {
      setLoadingCategories(true)
      const res = await fetch('/api/v1/catalog/categories?limit=100&status=active')
      const data = await safeJson(res) as { data?: Category[] } | null
      if (mounted) {
        setCategories(Array.isArray(data?.data) ? data.data : [])
        setLoadingCategories(false)
      }
    }
    loadCategories()
    return () => { mounted = false }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    setServerError(null)

    const body = {
      name:            form.name,
      product_type:    form.product_type,
      status:          form.status,
      iva_rate:        form.iva_rate,
      unit_of_measure: form.unit_of_measure,
      vendor:          form.vendor || null,
      category_id:     form.category_id ? form.category_id : null,
      description:     form.description || null,
      sku:             form.sku,
      barcode:         form.barcode || null,
      base_price:      form.base_price || null,
      cost_price:      form.cost_price || null,
      manage_stock:    form.manage_stock,
      stock_quantity:  form.stock_quantity,
    }

    const url    = isEdit ? `/api/v1/catalog/products/${product!.id}` : '/api/v1/catalog/products'
    const method = isEdit ? 'PATCH' : 'POST'

    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await safeJson(res) as unknown as { code?: string; details?: { fieldErrors?: FieldErrors }; error?: unknown }

    if (!res.ok) {
      if (data?.code === 'VALIDATION_ERROR') setErrors(data.details?.fieldErrors ?? {})
      else if (data.code === 'DUPLICATE_SKU') setServerError('El SKU ya existe para otro producto.')
      else if (typeof data?.error === 'string' && data.error.includes('<!DOCTYPE')) setServerError('Tu sesión expiró. Volvé a iniciar sesión.')
      else setServerError(typeof data?.error === 'string' ? data.error : 'Error inesperado')
      setSaving(false)
      return
    }

    onSaved()
  }

  return (
    <dialog
      ref={dialogRef}
      open
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 w-full h-full p-4"
      onClick={e => { if (e.target === dialogRef.current) onClose() }}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-sm border border-zinc-200 shadow-lg w-full max-w-xl flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
          <h2 className="text-sm font-semibold text-zinc-900">{isEdit ? 'Editar producto' : 'Nuevo producto'}</h2>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-lg leading-none">×</button>
        </div>

        <div className="px-5 py-2.5 border-b border-zinc-100">
          <div className="inline-flex rounded-sm border border-zinc-200 bg-zinc-50 p-0.5">
            <button
              type="button"
              className={`px-2.5 h-7 text-xs font-medium rounded-sm ${tab === 'general' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}
              onClick={() => setTab('general')}
            >
              General
            </button>
            <button
              type="button"
              className={`px-2.5 h-7 text-xs font-medium rounded-sm ${tab === 'pricing' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}
              onClick={() => setTab('pricing')}
            >
              Precios y stock
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {serverError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2">{serverError}</div>
          )}

          {tab === 'general' ? (
            <>
              <FormField label="Nombre *" htmlFor="product_name" error={errors.name?.[0]} required>
                <Input id="product_name" placeholder="Ej: Resma A4 500 hojas" error={!!errors.name?.[0]} {...fieldString('name')} />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Tipo" htmlFor="product_type" error={errors.product_type?.[0]}>
                  <select id="product_type" {...fieldString('product_type')} className="h-8 w-full px-2 text-sm border border-zinc-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-brand-500">
                    <option value="simple">Producto</option>
                    <option value="service">Servicio</option>
                  </select>
                </FormField>
                <FormField label="Estado" htmlFor="product_status" error={errors.status?.[0]}>
                  <select id="product_status" {...fieldString('status')} className="h-8 w-full px-2 text-sm border border-zinc-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-brand-500">
                    <option value="draft">Borrador</option>
                    <option value="active">Activo</option>
                    <option value="archived">Archivado</option>
                  </select>
                </FormField>
              </div>

              <FormField label="Categoría" htmlFor="product_category" error={errors.category_id?.[0]}>
                <select
                  id="product_category"
                  value={form.category_id}
                  onChange={(e) => setForm(f => ({ ...f, category_id: e.target.value }))}
                  className="h-8 w-full px-2 text-sm border border-zinc-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-zinc-100 disabled:text-zinc-400"
                  disabled={loadingCategories}
                >
                  <option value="">{loadingCategories ? 'Cargando…' : 'Sin categoría'}</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Alícuota IVA" htmlFor="product_iva_rate" error={errors.iva_rate?.[0]}>
                  <select id="product_iva_rate" {...fieldString('iva_rate')} className="h-8 w-full px-2 text-sm border border-zinc-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-brand-500">
                    <option value="0">Exento (0%)</option>
                    <option value="10.5">10,5%</option>
                    <option value="21">21%</option>
                    <option value="27">27%</option>
                  </select>
                </FormField>
                <FormField label="Unidad de medida" htmlFor="product_unit_of_measure" error={errors.unit_of_measure?.[0]}>
                  <select id="product_unit_of_measure" {...fieldString('unit_of_measure')} className="h-8 w-full px-2 text-sm border border-zinc-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-brand-500">
                    <option value="unidad">Unidad</option>
                    <option value="kg">Kg</option>
                    <option value="g">Gramo</option>
                    <option value="litro">Litro</option>
                    <option value="ml">Mililitro</option>
                    <option value="metro">Metro</option>
                    <option value="cm">Centímetro</option>
                    <option value="m2">m²</option>
                    <option value="m3">m³</option>
                    <option value="hora">Hora</option>
                    <option value="caja">Caja</option>
                    <option value="paquete">Paquete</option>
                    <option value="docena">Docena</option>
                    <option value="par">Par</option>
                    <option value="rollo">Rollo</option>
                  </select>
                </FormField>
              </div>

              <FormField label="Proveedor / Marca" htmlFor="product_vendor" error={errors.vendor?.[0]}>
                <Input id="product_vendor" placeholder="Ej: Samsung" error={!!errors.vendor?.[0]} {...fieldString('vendor')} />
              </FormField>

              <FormField label="Descripción" htmlFor="product_description" error={errors.description?.[0]}>
                <textarea
                  id="product_description"
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className={
                    `w-full rounded-sm border bg-white px-2.5 py-2 text-[13px] text-zinc-900 transition-colors
                    placeholder:text-zinc-400
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0
                    ${errors.description?.[0]
                      ? 'border-red-500 focus-visible:ring-red-200'
                      : 'border-zinc-300 focus-visible:ring-blue-200 focus-visible:border-blue-500'}`
                  }
                  placeholder="Opcional"
                />
              </FormField>
            </>
          ) : (
            <>
              <div className="border-b border-zinc-100 pb-3">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">SKU, precios y stock</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="SKU *" htmlFor="product_sku" error={errors.sku?.[0]} required>
                  <Input id="product_sku" placeholder="Ej: RES-A4-500" error={!!errors.sku?.[0]} {...fieldString('sku')} />
                </FormField>
                <FormField label="Código de barras" htmlFor="product_barcode" error={errors.barcode?.[0]}>
                  <Input id="product_barcode" placeholder="EAN / UPC" error={!!errors.barcode?.[0]} {...fieldString('barcode')} />
                </FormField>
                <FormField label="Precio de costo" htmlFor="product_cost_price" error={errors.cost_price?.[0]}>
                  <Input id="product_cost_price" type="number" step="0.01" min="0" placeholder="0.00" error={!!errors.cost_price?.[0]} {...fieldString('cost_price')} />
                </FormField>
                <FormField label="Precio de venta base" htmlFor="product_base_price" error={errors.base_price?.[0]}>
                  <Input id="product_base_price" type="number" step="0.01" min="0" placeholder="0.00" error={!!errors.base_price?.[0]} {...fieldString('base_price')} />
                </FormField>
              </div>

              <div className="border-t border-zinc-100 pt-4">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Stock</p>
                <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.manage_stock}
                    onChange={(e) => setForm(f => ({ ...f, manage_stock: e.target.checked }))}
                    className="accent-brand-600"
                  />
                  Controlar stock
                </label>

                <div className="mt-3">
                  <FormField label="Stock inicial" htmlFor="product_stock_quantity" error={errors.stock_quantity?.[0]}>
                    <Input
                      id="product_stock_quantity"
                      type="number"
                      step="1"
                      min="0"
                      value={String(form.stock_quantity)}
                      onChange={(e) => setForm(f => ({ ...f, stock_quantity: Number(e.target.value || 0) }))}
                      disabled={!form.manage_stock}
                      error={!!errors.stock_quantity?.[0]}
                    />
                  </FormField>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-200">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button type="submit" size="sm" disabled={saving}>{saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear producto'}</Button>
        </div>
      </form>
    </dialog>
  )
}
