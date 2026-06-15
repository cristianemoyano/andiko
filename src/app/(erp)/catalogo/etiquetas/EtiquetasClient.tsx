'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { Button } from '@/components/primitives/Button'
import { CatalogoSubNav } from '../CatalogoSubNav'

type Variant = {
  id: string
  sku: string | null
  barcode: string | null
  name: string | null
  base_price: string | null
  is_default: boolean
}

type Product = {
  id: string
  name: string
  status: string
  category_id: string | null
  category?: { id: string; name: string } | null
  variants: Variant[]
}

type Category = { id: string; name: string }

type LabelRow = {
  variantId: string
  productName: string
  variantName: string | null
  sku: string | null
  barcode: string | null
  price: string | null
  copies: number
  selected: boolean
}

const formatArs = (v: string | null) =>
  v == null
    ? '—'
    : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(Number(v))

export function EtiquetasClient() {
  const [categories, setCategories] = useState<Category[]>([])
  const [, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<LabelRow[]>([])
  const [size, setSize] = useState<'small' | 'large'>('small')

  useEffect(() => {
    void fetchJson<{ data: Category[] }>('/api/v1/catalog/categories?limit=100')
      .then(r => setCategories(r.data ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false

    const fetchAllPages = async () => {
      setLoading(true)
      setError(null)
      const all: Product[] = []
      let page = 1
      const limit = 100
      while (true) {
        const params = new URLSearchParams({ limit: String(limit), page: String(page), status: 'active' })
        if (categoryFilter) params.set('category_id', categoryFilter)
        if (search.trim()) params.set('search', search.trim())
        const r = await fetchJson<{ data: Product[]; total: number; pages: number }>(`/api/v1/catalog/products?${params.toString()}`)
        all.push(...(r.data ?? []))
        if (page >= (r.pages ?? 1)) break
        page++
      }
      return all
    }

    fetchAllPages()
      .then(fetched => {
        if (cancelled) return
        setProducts(fetched)
        setRows(
          fetched.flatMap(p =>
            p.variants.map(v => ({
              variantId: v.id,
              productName: p.name,
              variantName: v.name && v.name !== p.name ? v.name : null,
              sku: v.sku,
              barcode: v.barcode,
              price: v.base_price,
              copies: 1,
              selected: false,
            }))
          )
        )
      })
      .catch(e => { if (!cancelled) setError(getApiErrorMessage(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [categoryFilter, search])

  const allSelected = rows.length > 0 && rows.every(r => r.selected)
  const selectedCount = rows.filter(r => r.selected).length

  function toggleAll() {
    setRows(prev => prev.map(r => ({ ...r, selected: !allSelected })))
  }

  function toggleRow(variantId: string) {
    setRows(prev => prev.map(r => r.variantId === variantId ? { ...r, selected: !r.selected } : r))
  }

  function setCopies(variantId: string, val: number) {
    setRows(prev => prev.map(r => r.variantId === variantId ? { ...r, copies: Math.max(1, val) } : r))
  }

  function handlePrint() {
    const selected = rows.filter(r => r.selected)
    if (!selected.length) return
    const labels = selected.map(r => ({
      name: r.productName,
      variantName: r.variantName ?? '',
      sku: r.sku ?? '',
      barcode: r.barcode ?? '',
      price: r.price ?? '',
      copies: r.copies,
    }))
    const key = `etiquetas_print_${Date.now()}`
    sessionStorage.setItem(key, JSON.stringify(labels))
    window.open(`/etiquetas/print?key=${key}&size=${size}`, '_blank')
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar breadcrumbs={[{ label: 'Catálogo', href: '/catalogo/productos' }, { label: 'Etiquetas de góndola' }]} />
      <CatalogoSubNav />

      <div className="flex items-center gap-3 border-b border-border bg-surface px-5 py-3 print:hidden flex-wrap">
        <select
          className="rounded border border-border-strong px-2 py-1.5 text-sm text-fg-muted"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Buscar producto o SKU…"
          className="rounded border border-border-strong px-2 py-1.5 text-sm text-fg-muted w-56"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-fg-muted">Tamaño:</span>
          <select
            className="rounded border border-border-strong px-2 py-1.5 text-sm text-fg-muted"
            value={size}
            onChange={e => setSize(e.target.value as 'small' | 'large')}
          >
            <option value="small">Pequeña (5×3 cm)</option>
            <option value="large">Grande (10×5 cm)</option>
          </select>
          <Button
            type="button"
            variant="primary"
            onClick={handlePrint}
            disabled={selectedCount === 0}
          >
            Imprimir selección ({selectedCount})
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {error && (
          <p className="m-5 text-sm text-danger">{error}</p>
        )}

        {!error && (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-muted text-left text-xs text-fg-muted border-b border-border">
              <tr>
                <th className="px-4 py-2 w-8">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                <th className="px-4 py-2">Producto</th>
                <th className="px-4 py-2">SKU</th>
                <th className="px-4 py-2">Precio</th>
                <th className="px-4 py-2 w-24">Copias</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-fg-subtle">Cargando…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-fg-subtle">Sin productos</td></tr>
              )}
              {!loading && rows.map(row => (
                <tr
                  key={row.variantId}
                  className={row.selected ? 'bg-blue-50' : 'hover:bg-surface-muted'}
                  onClick={() => toggleRow(row.variantId)}
                >
                  <td className="px-4 py-2" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={row.selected}
                      onChange={() => toggleRow(row.variantId)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <span className="font-medium text-fg">{row.productName}</span>
                    {row.variantName && (
                      <span className="ml-1 text-fg-muted">— {row.variantName}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-fg-muted">{row.sku ?? '—'}</td>
                  <td className="px-4 py-2 font-mono">{formatArs(row.price)}</td>
                  <td className="px-4 py-2" onClick={e => e.stopPropagation()}>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={row.copies}
                      onChange={e => setCopies(row.variantId, parseInt(e.target.value) || 1)}
                      className="w-16 rounded border border-border-strong px-2 py-1 text-sm text-center"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
