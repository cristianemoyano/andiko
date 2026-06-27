'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { Button } from '@/components/primitives/Button'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { CatalogoSubNav } from '../CatalogoSubNav'

type Category = { id: string; name: string }

type LabelRow = {
  variant_id: string
  product_name: string
  variant_name: string | null
  sku: string | null
  barcode: string | null
  price: string | null
}

type LabelSelection = {
  productName: string
  variantName: string | null
  sku: string | null
  barcode: string | null
  price: string | null
  copies: number
}

const PAGE_SIZE = 100

const formatArs = (v: string | null) =>
  v == null
    ? '—'
    : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(Number(v))

export function EtiquetasClient() {
  const [categories, setCategories] = useState<Category[]>([])
  const [rows, setRows] = useState<LabelRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [search, setSearch] = useState('')
  const [size, setSize] = useState<'small' | 'large'>('small')
  const [selection, setSelection] = useState<Map<string, LabelSelection>>(() => new Map())

  useEffect(() => {
    void fetchJson<{ data: Category[] }>('/api/v1/catalog/categories?limit=100')
      .then((r) => setCategories(r.data ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        page: String(page),
      })
      if (categoryFilter) params.set('category_id', categoryFilter)
      if (search.trim()) params.set('search', search.trim())

      try {
        const r = await fetchJson<{ data: LabelRow[]; total: number }>(
          `/api/v1/catalog/products/labels?${params.toString()}`,
        )
        if (cancelled) return
        setRows(r.data ?? [])
        setTotal(r.total ?? 0)
      } catch (e) {
        if (!cancelled) setError(getApiErrorMessage(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [categoryFilter, search, page])

  const selectedCount = selection.size

  const allPageSelected = rows.length > 0 && rows.every((r) => selection.has(r.variant_id))

  const toggleRow = useCallback((row: LabelRow) => {
    setSelection((prev) => {
      const next = new Map(prev)
      if (next.has(row.variant_id)) {
        next.delete(row.variant_id)
      } else {
        next.set(row.variant_id, {
          productName: row.product_name,
          variantName: row.variant_name,
          sku: row.sku,
          barcode: row.barcode,
          price: row.price,
          copies: prev.get(row.variant_id)?.copies ?? 1,
        })
      }
      return next
    })
  }, [])

  const toggleAllPage = useCallback(() => {
    setSelection((prev) => {
      const next = new Map(prev)
      if (allPageSelected) {
        for (const row of rows) next.delete(row.variant_id)
      } else {
        for (const row of rows) {
          next.set(row.variant_id, {
            productName: row.product_name,
            variantName: row.variant_name,
            sku: row.sku,
            barcode: row.barcode,
            price: row.price,
            copies: prev.get(row.variant_id)?.copies ?? 1,
          })
        }
      }
      return next
    })
  }, [allPageSelected, rows])

  const setCopies = useCallback((variantId: string, val: number, row: LabelRow) => {
    const copies = Math.max(1, Math.min(99, val))
    setSelection((prev) => {
      const next = new Map(prev)
      const existing = next.get(variantId)
      if (existing) {
        next.set(variantId, { ...existing, copies })
      } else {
        next.set(variantId, {
          productName: row.product_name,
          variantName: row.variant_name,
          sku: row.sku,
          barcode: row.barcode,
          price: row.price,
          copies,
        })
      }
      return next
    })
  }, [])

  function handlePrint() {
    if (selectedCount === 0) return
    const labels = Array.from(selection.values()).map((r) => ({
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

  const columns = useMemo((): Column<LabelRow>[] => [
    {
      key: '_select',
      header: '',
      className: 'w-10',
      mobileRole: 'hidden',
      render: (row) => (
        <input
          type="checkbox"
          checked={selection.has(row.variant_id)}
          onChange={() => toggleRow(row)}
          aria-label={`Seleccionar ${row.product_name}`}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    {
      key: 'product_name',
      header: 'Producto',
      sortable: true,
      mobileRole: 'title',
      render: (row) => (
        <span>
          <span className="font-medium text-fg">{row.product_name}</span>
          {row.variant_name && (
            <span className="ml-1 text-fg-muted">— {row.variant_name}</span>
          )}
        </span>
      ),
    },
    {
      key: 'sku',
      header: 'SKU',
      sortable: true,
      mobileRole: 'subtitle',
      render: (row) => <span className="text-fg-muted">{row.sku ?? '—'}</span>,
    },
    {
      key: 'price',
      header: 'Precio',
      align: 'right',
      sortable: true,
      mobileRole: 'amount',
      render: (row) => <span className="font-mono tabular-nums">{formatArs(row.price)}</span>,
    },
    {
      key: 'copies',
      header: 'Copias',
      align: 'right',
      className: 'w-24',
      mobileRole: 'hidden',
      render: (row) => (
        <input
          type="number"
          min={1}
          max={99}
          value={selection.get(row.variant_id)?.copies ?? 1}
          onChange={(e) => setCopies(row.variant_id, parseInt(e.target.value, 10) || 1, row)}
          onClick={(e) => e.stopPropagation()}
          className="w-16 rounded-sm border border-border-strong px-2 py-1 text-sm text-center bg-surface focus:outline-none focus:border-ring"
        />
      ),
    },
  ], [selection, toggleRow, setCopies])

  return (
    <div className="flex h-full flex-col">
      <TopBar breadcrumbs={[{ label: 'Catálogo', href: '/catalogo/productos' }, { label: 'Etiquetas de góndola' }]} />
      <CatalogoSubNav />

      <PageBody padding="p-0">
        {error && (
          <div className="m-5 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        {!error && (
          <DataTable
            columns={columns}
            data={loading ? [] : rows}
            keyExtractor={(row) => row.variant_id}
            onRowClick={toggleRow}
            stickyFirstColumn
            emptyMessage={loading ? 'Cargando…' : 'Sin productos'}
            toolbar={
              <>
                <select
                  className="h-[30px] text-[13px] border border-border-strong rounded-sm px-2 bg-surface focus:outline-none focus:border-ring text-fg-muted"
                  value={categoryFilter}
                  onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
                >
                  <option value="">Todas las categorías</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <div className="relative flex items-center w-full sm:w-auto">
                  <svg className="absolute left-2 text-fg-subtle pointer-events-none" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5l3 3" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Buscar producto o SKU…"
                    className="pl-7 pr-3 h-[30px] text-[13px] border border-border-strong rounded-sm w-full sm:w-56 bg-surface focus:outline-none focus:border-ring"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  />
                </div>

                <label className="flex items-center gap-1.5 text-[12px] text-fg-muted cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleAllPage}
                    className="rounded border-border-strong"
                  />
                  Página
                </label>

                <select
                  className="h-[30px] text-[13px] border border-border-strong rounded-sm px-2 bg-surface focus:outline-none focus:border-ring text-fg-muted"
                  value={size}
                  onChange={(e) => setSize(e.target.value as 'small' | 'large')}
                >
                  <option value="small">Pequeña (5×3 cm)</option>
                  <option value="large">Grande (10×5 cm)</option>
                </select>

                <span className="flex-1" />
                <span className="text-[12px] text-fg-muted hidden sm:inline">
                  {selectedCount > 0 ? `${selectedCount} seleccionada${selectedCount !== 1 ? 's' : ''} · ` : ''}
                  {total} variante{total !== 1 ? 's' : ''}
                </span>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handlePrint}
                  disabled={selectedCount === 0}
                >
                  Imprimir ({selectedCount})
                </Button>
              </>
            }
            footer={
              total > 0 ? (
                <TablePagination
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={total}
                  onPageChange={setPage}
                />
              ) : undefined
            }
          />
        )}
      </PageBody>
    </div>
  )
}
