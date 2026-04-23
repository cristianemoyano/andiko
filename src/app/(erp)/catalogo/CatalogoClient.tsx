'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { ProductModal } from './ProductModal'

type Variant = {
  id: string
  sku: string
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

const COLUMNS: Column<Product>[] = [
  {
    key: 'name',
    header: 'Nombre',
    sortable: true,
    render: row => <span className="font-medium text-zinc-900">{row.name}</span>,
  },
  {
    key: 'sku',
    header: 'SKU',
    render: row => {
      const sku = row.variants?.[0]?.sku
      return sku ? <span className="font-mono text-xs text-zinc-600">{sku}</span> : <span className="text-zinc-400">—</span>
    },
  },
  {
    key: 'category',
    header: 'Categoría',
    render: row => row.category?.name ?? <span className="text-zinc-400">—</span>,
  },
  {
    key: 'product_type',
    header: 'Tipo',
    render: row => TYPE_LABEL[row.product_type] ?? row.product_type,
  },
  {
    key: 'iva_rate',
    header: 'IVA',
    render: row => <span className="text-xs">{row.iva_rate}%</span>,
  },
  {
    key: 'base_price',
    header: 'Precio base',
    render: row => {
      const price = row.variants?.[0]?.base_price
      return price ? (
        <span className="tabular-nums">${Number(price).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
      ) : <span className="text-zinc-400">—</span>
    },
  },
  {
    key: 'stock',
    header: 'Stock',
    render: row => {
      const v = row.variants?.[0]
      if (!v?.manage_stock) return <span className="text-zinc-400 text-xs">Sin seguimiento</span>
      return <span className="tabular-nums">{v.stock_quantity}</span>
    },
  },
  {
    key: 'status',
    header: 'Estado',
    render: row => (
      <Badge status={STATUS_BADGE[row.status] ?? 'neutral'}>
        {STATUS_LABEL[row.status] ?? row.status}
      </Badge>
    ),
  },
]

export function CatalogoClient() {
  const router = useRouter()
  const [products, setProducts]     = useState<Product[]>([])
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(1)
  const [search, setSearch]         = useState('')
  const [status, setStatus]         = useState('')
  const [loading, setLoading]       = useState(true)
  const [serverError, setServerError] = useState<string | null>(null)
  const [modalOpen, setModalOpen]   = useState(false)
  const [editing, setEditing]       = useState<ProductForEdit>(null)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)

  async function safeJson(res: Response): Promise<unknown | null> {
    const text = await res.text()
    if (!text) return null
    try { return JSON.parse(text) } catch { return { error: text } }
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
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
      if (mounted) setLoading(false)
    })()
    return () => { mounted = false }
  }, [page, search, status])

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setSearch(v)
    setPage(1)
  }

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value
    setStatus(v)
    setPage(1)
  }

  function handlePageChange(p: number) {
    setPage(p)
  }

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
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (search) params.set('search', search)
    if (status) params.set('status', status)
    const res = await fetch(`/api/v1/catalog/products?${params}`)
    const data = (await safeJson(res)) as { data?: Product[]; total?: number } | null
    setProducts(data?.data ?? [])
    setTotal(data?.total ?? 0)
    setLoading(false)
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Catálogo' }]}
        actions={
          <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true) }}>
            + Nuevo producto
          </Button>
        }
      />

      <div className="flex-1 p-5 overflow-auto">
        {serverError ? (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {serverError}
          </div>
        ) : null}
        <DataTable
          columns={[
            ...COLUMNS,
            {
              key: '_actions',
              header: '',
              render: row => (
                <div className="flex items-center gap-1 justify-end">
                  <Button variant="ghost" size="xs" onClick={(e) => { e.stopPropagation(); router.push(`/catalogo/${row.id}`) }}>
                    Ver
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    disabled={loadingEdit}
                    onClick={(e) => { e.stopPropagation(); openEdit(row.id) }}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={(e) => { e.stopPropagation(); setProductToDelete(row) }}
                  >
                    Eliminar
                  </Button>
                </div>
              ),
              align: 'right',
              className: 'w-[120px]',
            },
          ]}
          data={loading ? [] : products}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => router.push(`/catalogo/${row.id}`)}
          emptyMessage={loading ? 'Cargando…' : 'No hay productos. Creá el primero.'}
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
                  onChange={handleSearch}
                  className="pl-7 pr-3 h-[30px] text-[13px] border border-zinc-300 rounded-sm w-56 bg-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <select
                value={status}
                onChange={handleStatusChange}
                className="h-[30px] text-[13px] border border-zinc-300 rounded-sm px-2 bg-white focus:outline-none focus:border-blue-500 text-zinc-700"
              >
                <option value="">Todos los estados</option>
                <option value="draft">Borrador</option>
                <option value="active">Activo</option>
                <option value="archived">Archivado</option>
              </select>

              <span className="flex-1" />
              <span className="text-[12px] text-zinc-500">{total} registro{total !== 1 ? 's' : ''}</span>
            </>
          }
          footer={
            total > 0 ? (
              <TablePagination
                page={page}
                total={total}
                pageSize={PAGE_SIZE}
                onPageChange={handlePageChange}
              />
            ) : undefined
          }
        />
      </div>

      {modalOpen && (
        <ProductModal
          product={editing}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); setEditing(null) }}
        />
      )}

      <ConfirmDialog
        open={!!productToDelete}
        onOpenChange={(open) => { if (!open) setProductToDelete(null) }}
        title="Eliminar producto"
        description={productToDelete ? `Se eliminará ${productToDelete.name}.` : ''}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDeleteProduct}
      />
    </div>
  )
}
