'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { GroupedDataTable, TablePagination, ConfirmDialog, type GroupedColumn, type RowGroup } from '@/components/erp'
import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { ProductModal } from './ProductModal'
import { CatalogoSubNav } from './CatalogoSubNav'

type Variant = {
  id: string
  sku: string
  name: string | null
  base_price: string | null
  stock_quantity: number
  manage_stock: boolean
}

type Product = {
  id: string
  name: string
  product_type: 'simple' | 'service'
  status: 'draft' | 'active' | 'archived'
  iva_rate: string
  unit_of_measure: string
  vendor: string | null
  category_id: string | null
  category?: { id: string; name: string } | null
  variants: Variant[]
}

type ProductForEdit = {
  id: string
  name: string
  product_type: string
  status: string
  iva_rate: string
  unit_of_measure: string
  vendor: string | null
  category_id: string | null
  description: string | null
  variants: Array<{
    sku: string
    base_price: string | null
    cost_price: string | null
    barcode: string | null
    manage_stock?: boolean
    stock_quantity?: number
  }>
} | null

const STATUS_LABEL: Record<string, string> = {
  draft:    'Borrador',
  active:   'Activo',
  archived: 'Archivado',
}

const STATUS_BADGE: Record<string, 'neutral' | 'success' | 'draft'> = {
  draft:    'draft',
  active:   'success',
  archived: 'neutral',
}

const TYPE_LABEL: Record<string, string> = {
  simple:  'Producto',
  service: 'Servicio',
}

const PAGE_SIZE = 20

function fmtPrice(val: string | null | undefined) {
  if (!val) return null
  return `$${Number(val).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
}

function priceRange(variants: Variant[]) {
  const prices = variants.map(v => v.base_price ? Number(v.base_price) : null).filter((x): x is number => x !== null)
  if (!prices.length) return null
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? fmtPrice(String(min)) : `desde ${fmtPrice(String(min))}`
}

export function CatalogoClient() {
  const router = useRouter()
  const [products, setProducts]     = useState<Product[]>([])
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(1)
  const [search, setSearch]         = useState('')
  const [status, setStatus]         = useState('')
  const [serverError, setServerError] = useState<string | null>(null)
  const [modalOpen, setModalOpen]   = useState(false)
  const [editing, setEditing]       = useState<ProductForEdit>(null)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [refresh, setRefresh]       = useState(0)

  async function safeJson(res: Response): Promise<unknown | null> {
    const text = await res.text()
    if (!text) return null
    try { return JSON.parse(text) } catch { return { error: text } }
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setServerError(null)
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (search) params.set('search', search)
      if (status) params.set('status', status)
      const res = await fetch(`/api/v1/catalog/products?${params}`)
      const data = (await safeJson(res)) as { data?: Product[]; total?: number; error?: string; code?: string } | null
      if (!mounted) return
      if (res.ok) {
        setProducts(data?.data ?? [])
        setTotal(data?.total ?? 0)
      } else {
        const msg = data?.error
          ? `${data.error}${data.code ? ` (${data.code})` : ''}`
          : `No se pudo cargar el catálogo (HTTP ${res.status}).`
        setServerError(msg)
        setProducts([])
        setTotal(0)
      }
    })()
    return () => { mounted = false }
  }, [page, search, status, refresh])

  async function openEdit(id: string) {
    setLoadingEdit(true)
    const res = await fetch(`/api/v1/catalog/products/${id}`, { cache: 'no-store' })
    const data = (await safeJson(res)) as ProductForEdit
    setEditing(data ?? null)
    setModalOpen(true)
    setLoadingEdit(false)
  }

  async function handleDeleteProduct() {
    if (!productToDelete) return
    await fetch(`/api/v1/catalog/products/${productToDelete.id}`, { method: 'DELETE' })
    setProductToDelete(null)
    setRefresh(r => r + 1)
  }

  // ── Column definitions ───────────────────────────────────────────────────────
  const parentColumns = useMemo<GroupedColumn<Product>[]>(() => [
    {
      key: 'name',
      header: 'Nombre / Variante',
      render: p => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-zinc-900">{p.name}</span>
          {p.variants.length > 1 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-500 border border-zinc-200">
              {p.variants.length} variantes
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'sku',
      header: 'SKU',
      render: p => {
        if (p.variants.length > 1) return <span className="text-zinc-400 text-xs italic">múltiples</span>
        const sku = p.variants[0]?.sku
        return sku ? <span className="font-mono text-xs text-zinc-600">{sku}</span> : <span className="text-zinc-400">—</span>
      },
    },
    {
      key: 'category',
      header: 'Categoría',
      render: p => p.category?.name
        ? <span className="text-zinc-600">{p.category.name}</span>
        : <span className="text-zinc-400">—</span>,
    },
    {
      key: 'type',
      header: 'Tipo · IVA',
      render: p => (
        <>
          <span className="text-zinc-600">{TYPE_LABEL[p.product_type] ?? p.product_type}</span>
          <span className="text-zinc-400 text-xs ml-1">· {p.iva_rate}%</span>
        </>
      ),
    },
    {
      key: 'price',
      header: 'Precio',
      align: 'right',
      render: p => {
        const display = priceRange(p.variants)
        return display ? <span className="tabular-nums">{display}</span> : <span className="text-zinc-400">—</span>
      },
    },
    {
      key: 'stock',
      header: 'Stock',
      align: 'right',
      render: p => {
        const managed = p.variants.filter(v => v.manage_stock)
        if (!managed.length) return <span className="text-zinc-400 text-xs">—</span>
        const total = managed.reduce((s, v) => s + v.stock_quantity, 0)
        return <span className="tabular-nums">{total}{p.variants.length > 1 ? ' total' : ''}</span>
      },
    },
    {
      key: 'status',
      header: 'Estado',
      render: p => <Badge status={STATUS_BADGE[p.status] ?? 'neutral'}>{STATUS_LABEL[p.status] ?? p.status}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      render: p => (
        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="xs" onClick={e => { e.stopPropagation(); router.push(`/catalogo/${p.id}`) }}>Ver</Button>
          <Button variant="ghost" size="xs" disabled={loadingEdit} onClick={e => { e.stopPropagation(); void openEdit(p.id) }}>Editar</Button>
          <Button variant="ghost" size="xs" onClick={e => { e.stopPropagation(); setProductToDelete(p) }}>Eliminar</Button>
        </div>
      ),
    },
  ], [loadingEdit, router]) // eslint-disable-line react-hooks/exhaustive-deps

  const childColumns = useMemo<GroupedColumn<Variant>[]>(() => [
    {
      key: 'name',
      header: '',
      render: v => <span className="text-zinc-600 text-[13px]">{v.name ?? 'Variante'}</span>,
    },
    {
      key: 'sku',
      header: '',
      render: v => v.sku
        ? <span className="font-mono text-xs text-zinc-500">{v.sku}</span>
        : <span className="text-zinc-300">—</span>,
    },
    { key: 'category', header: '', render: () => <span className="text-zinc-300">—</span> },
    { key: 'type',     header: '', render: () => <span className="text-zinc-300">—</span> },
    {
      key: 'price',
      header: '',
      align: 'right',
      render: v => {
        const p = fmtPrice(v.base_price)
        return p ? <span className="tabular-nums text-zinc-600">{p}</span> : <span className="text-zinc-300">—</span>
      },
    },
    {
      key: 'stock',
      header: '',
      align: 'right',
      render: v => v.manage_stock
        ? <span className="tabular-nums text-zinc-600">{v.stock_quantity}</span>
        : <span className="text-zinc-300">—</span>,
    },
    { key: 'status',  header: '', render: () => null },
    { key: 'actions', header: '', render: () => null },
  ], [])

  const groups = useMemo<RowGroup<Product, Variant>[]>(
    () => products.map(p => ({ parent: p, children: p.variants })),
    [products],
  )

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Catálogo', href: '/catalogo/productos' }, { label: 'Productos' }]}
        actions={
          <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true) }}>
            + Nuevo producto
          </Button>
        }
      />
      <CatalogoSubNav />

      <div className="flex-1 p-5 overflow-auto">
        {serverError && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {serverError}
          </div>
        )}
        <GroupedDataTable
          parentColumns={parentColumns}
          childColumns={childColumns}
          groups={groups}
          parentKey={p => p.id}
          childKey={v => v.id}
          onRowClick={p => router.push(`/catalogo/${p.id}`)}
          emptyMessage="No hay productos. Creá el primero."
          toolbar={
            <>
              <div className="relative flex items-center">
                <svg className="absolute left-2 text-zinc-400 pointer-events-none" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/>
                </svg>
                <input
                  type="search"
                  placeholder="Buscar por nombre o proveedor…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  className="pl-7 pr-3 h-[30px] text-[13px] border border-zinc-300 rounded-sm w-56 bg-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <select
                value={status}
                onChange={e => { setStatus(e.target.value); setPage(1) }}
                className="h-[30px] text-[13px] border border-zinc-300 rounded-sm px-2 bg-white focus:outline-none focus:border-blue-500 text-zinc-700"
              >
                <option value="">Todos los estados</option>
                <option value="draft">Borrador</option>
                <option value="active">Activo</option>
                <option value="archived">Archivado</option>
              </select>
              <span className="flex-1" />
              <span className="text-[12px] text-zinc-500">{total} producto{total !== 1 ? 's' : ''}</span>
            </>
          }
          footer={
            total > 0 ? (
              <TablePagination page={page} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
            ) : undefined
          }
        />
      </div>

      {modalOpen && (
        <ProductModal
          product={editing}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); setEditing(null); setRefresh(r => r + 1) }}
        />
      )}

      <ConfirmDialog
        open={!!productToDelete}
        onOpenChange={open => { if (!open) setProductToDelete(null) }}
        title="Eliminar producto"
        description={productToDelete ? `Se eliminará ${productToDelete.name}.` : ''}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDeleteProduct}
      />
    </div>
  )
}
