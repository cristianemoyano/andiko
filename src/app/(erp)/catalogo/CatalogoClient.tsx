'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifyApiError, notifySuccess } from '@/lib/notify'
import { WOO_IMPORT_SOURCE } from '@/modules/integrations/woocommerce/woo-address.utils'
import {
  GroupedDataTable,
  TablePagination,
  ConfirmDialog,
  ImportModal,
  WooSyncBadge,
  type GroupedColumn,
  type RowGroup,
  type TableRowSelection,
  type ImportDefaultFieldConfig,
} from '@/components/erp'
import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Image } from '@/components/primitives/Image'
import { ProductModal } from './ProductModal'
import { CatalogoSubNav } from './CatalogoSubNav'
import { PRODUCT_CSV_HEADERS_FOR_IMPORT } from '@/modules/catalog/products-csv-adapter'

const CATALOG_IMPORT_DEFAULT_FIELDS: ImportDefaultFieldConfig[] = [
  {
    key: 'product_type',
    label: 'Tipo de producto',
    description:
      'Si la celda mapeada a "Tipo" está vacía, se usa este valor (p. ej. simple para catálogos que no distinguen servicios).',
    inputKind: 'select',
    options: [
      { value: '', label: '— Sin valor por defecto —' },
      { value: 'simple', label: 'Simple' },
      { value: 'service', label: 'Servicio' },
    ],
  },
  {
    key: 'status',
    label: 'Estado',
    description: 'Si la columna de estado del CSV está vacía.',
    inputKind: 'select',
    options: [
      { value: '', label: '— Sin valor por defecto —' },
      { value: 'active', label: 'Activo' },
      { value: 'draft', label: 'Borrador' },
      { value: 'archived', label: 'Archivado' },
    ],
  },
  {
    key: 'stock_quantity',
    label: 'Stock',
    description: 'Si la celda de cantidad en stock está vacía (número entero ≥ 0).',
    inputKind: 'text',
    placeholder: 'ej. 0',
  },
  {
    key: 'manage_stock',
    label: 'Gestionar stock',
    description: 'Si la celda está vacía (por defecto: sí).',
    inputKind: 'select',
    defaultValue: '1',
    options: [
      { value: '', label: '— Sin valor por defecto —' },
      { value: '1', label: 'Sí (1)' },
      { value: '0', label: 'No (0)' },
      { value: 'true', label: 'true' },
      { value: 'false', label: 'false' },
    ],
  },
]

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
  images?: Array<{ url: string; alt: string | null; position: number }>
  variants: Variant[]
  source: string | null
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
  images?: Array<{ url: string; alt: string | null; position: number }>
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

export function CatalogoClient({ showWooColumn = false }: { showWooColumn?: boolean }) {
  const router = useRouter()
  const [products, setProducts]     = useState<Product[]>([])
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(1)
  const [search, setSearch]         = useState('')
  const [status, setStatus]         = useState('')
  const [sourceFilter, setSourceFilter] = useState<'woocommerce' | ''>('')
  const [serverError, setServerError] = useState<string | null>(null)
  const [modalOpen, setModalOpen]   = useState(false)
  const [editing, setEditing]       = useState<ProductForEdit>(null)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [refresh, setRefresh]       = useState(0)
  const [importOpen, setImportOpen] = useState(false)
  const [importSession, setImportSession] = useState(0)
  const [savedImportFieldMaps, setSavedImportFieldMaps] = useState<
    Array<{ external_header: string; internal_field_key: string }>
  >([])
  const [importWarehouses, setImportWarehouses] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    if (!importOpen) return
    let mounted = true
    ;(async () => {
      try {
        const [mapsData, whData] = await Promise.all([
          fetchJson<{
            data?: Array<{ external_header: string; internal_field_key: string }>
          }>('/api/v1/catalog/import-field-maps'),
          fetchJson<{ data?: Array<{ id: string; name: string }> }>(
            '/api/v1/catalog/import-warehouses',
          ),
        ])
        if (!mounted) return
        setSavedImportFieldMaps(mapsData?.data ?? [])
        setImportWarehouses(whData?.data ?? [])
      } catch {
        if (!mounted) return
        setSavedImportFieldMaps([])
        setImportWarehouses([])
      }
    })()
    return () => {
      mounted = false
    }
  }, [importOpen])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setServerError(null)
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (search) params.set('search', search)
      if (status) params.set('status', status)
      if (showWooColumn && sourceFilter) params.set('source', sourceFilter)
      try {
        const data = await fetchJson<{ data?: Product[]; total?: number }>(
          `/api/v1/catalog/products?${params}`,
        )
        if (!mounted) return
        setProducts(data?.data ?? [])
        setTotal(data?.total ?? 0)
      } catch (e) {
        if (!mounted) return
        setServerError(getApiErrorMessage(e))
        setProducts([])
        setTotal(0)
      }
    })()
    return () => { mounted = false }
  }, [page, search, status, sourceFilter, showWooColumn, refresh])

  async function openEdit(id: string) {
    setLoadingEdit(true)
    try {
      const data = await fetchJson<ProductForEdit>(`/api/v1/catalog/products/${id}`, { cache: 'no-store' })
      setEditing(data ?? null)
      setModalOpen(true)
    } catch (e) {
      notifyApiError(e)
    } finally {
      setLoadingEdit(false)
    }
  }

  async function handleDeleteProduct() {
    if (!productToDelete) return
    try {
      await fetchJson(`/api/v1/catalog/products/${productToDelete.id}`, { method: 'DELETE' })
      setProductToDelete(null)
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(productToDelete.id)
        return next
      })
      notifySuccess('Producto eliminado')
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    }
  }

  const pageProductIds = useMemo(() => products.map(p => p.id), [products])
  const selectedCount = selectedIds.size
  const allPageSelected = pageProductIds.length > 0 && pageProductIds.every(id => selectedIds.has(id))

  const toggleRowSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAllPageSelection = useCallback(() => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allPageSelected) {
        for (const id of pageProductIds) next.delete(id)
      } else {
        for (const id of pageProductIds) next.add(id)
      }
      return next
    })
  }, [allPageSelected, pageProductIds])

  const tableSelection = useMemo<TableRowSelection>(() => ({
    selectedIds,
    onToggleRow: toggleRowSelection,
    onToggleAllOnPage: toggleAllPageSelection,
    pageIds: pageProductIds,
  }), [selectedIds, toggleRowSelection, toggleAllPageSelection, pageProductIds])

  async function handleBulkDelete() {
    if (selectedCount === 0) return
    try {
      const result = await fetchJson<{ deleted: number; errors: { id: string; message: string }[] }>(
        '/api/v1/catalog/products/bulk-delete',
        {
          method: 'POST',
          body: JSON.stringify({ ids: Array.from(selectedIds) }),
        },
      )
      setSelectedIds(prev => {
        const next = new Set(prev)
        for (const id of selectedIds) {
          if (!result.errors?.some(e => e.id === id)) next.delete(id)
        }
        return next
      })
      if (result.deleted > 0) {
        notifySuccess(
          result.deleted === 1
            ? '1 producto eliminado'
            : `${result.deleted} productos eliminados`,
        )
        setRefresh(r => r + 1)
      }
      if (result.errors?.length) {
        notifyApiError(new Error(`${result.errors.length} producto(s) no se pudieron eliminar`))
      }
    } catch (e) {
      notifyApiError(e)
      throw e
    }
  }

  function handleExport() {
    const params = new URLSearchParams({
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
    })
    const url = `/api/v1/catalog/products/export${params.size > 0 ? `?${params}` : ''}`
    window.location.href = url
  }

  // ── Column definitions ───────────────────────────────────────────────────────
  const parentColumns = useMemo<GroupedColumn<Product>[]>(() => {
    const columns: GroupedColumn<Product>[] = [
    {
      key: 'name',
      header: 'Nombre / Variante',
      mobileRole: 'title',
      render: p => (
        <div className="flex items-center gap-3">
          <Image
            src={p.images?.[0]?.url}
            alt={p.images?.[0]?.alt ?? p.name}
            width={56}
            height={56}
            className="h-14 w-14 flex-shrink-0"
          />
          <span className="font-medium text-fg leading-tight">{p.name}</span>
          {p.variants.length > 1 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-hover text-fg-muted border border-border">
              {p.variants.length} variantes
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'sku',
      header: 'SKU',
      mobileRole: 'subtitle',
      render: p => {
        if (p.variants.length > 1) return <span className="text-fg-subtle text-xs italic">múltiples</span>
        const sku = p.variants[0]?.sku
        return sku ? <span className="font-mono text-xs text-fg-muted">{sku}</span> : <span className="text-fg-subtle">—</span>
      },
    },
    {
      key: 'category',
      header: 'Categoría',
      mobileRole: 'hidden',
      render: p => p.category?.name
        ? <span className="text-fg-muted">{p.category.name}</span>
        : <span className="text-fg-subtle">—</span>,
    },
    {
      key: 'type',
      header: 'Tipo · IVA',
      mobileRole: 'hidden',
      render: p => (
        <>
          <span className="text-fg-muted">{TYPE_LABEL[p.product_type] ?? p.product_type}</span>
          <span className="text-fg-subtle text-xs ml-1">· {p.iva_rate}%</span>
        </>
      ),
    },
    {
      key: 'price',
      header: 'Precio',
      align: 'right',
      mobileRole: 'amount',
      render: p => {
        const display = priceRange(p.variants)
        return display ? <span className="tabular-nums">{display}</span> : <span className="text-fg-subtle">—</span>
      },
    },
    {
      key: 'stock',
      header: 'Stock',
      align: 'right',
      mobileRole: 'hidden',
      render: p => {
        const managed = p.variants.filter(v => v.manage_stock)
        if (!managed.length) return <span className="text-fg-subtle text-xs">—</span>
        const total = managed.reduce((s, v) => s + v.stock_quantity, 0)
        return <span className="tabular-nums">{total}{p.variants.length > 1 ? ' total' : ''}</span>
      },
    },
    {
      key: 'woo',
      header: 'Origen',
      mobileRole: 'hidden',
      render: p => <WooSyncBadge synced={p.source === WOO_IMPORT_SOURCE} />,
    },
    {
      key: 'status',
      header: 'Estado',
      mobileRole: 'badge',
      render: p => (
        <Badge
          status={STATUS_BADGE[p.status] ?? 'neutral'}
          {...(p.status === 'archived' ? { 'data-testid': 'archived-badge' } : {})}
        >
          {STATUS_LABEL[p.status] ?? p.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-[140px]',
      mobileRole: 'hidden',
      render: p => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="xs"
            data-testid="edit-product-btn"
            data-product-name={p.name}
            disabled={loadingEdit}
            onClick={e => { e.stopPropagation(); void openEdit(p.id) }}
          >
            Editar
          </Button>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            <Button variant="ghost" size="xs" onClick={e => { e.stopPropagation(); router.push(`/catalogo/${p.id}`) }}>Ver</Button>
            <Button
              variant="ghost"
              size="xs"
              data-testid="delete-product-btn"
              data-product-name={p.name}
              onClick={e => { e.stopPropagation(); setProductToDelete(p) }}
            >
              Eliminar
            </Button>
          </div>
        </div>
      ),
    },
    ]
    return showWooColumn ? columns : columns.filter(col => col.key !== 'woo')
  }, [loadingEdit, router, showWooColumn])  

  const childColumns = useMemo<GroupedColumn<Variant>[]>(() => {
    const columns: GroupedColumn<Variant>[] = [
    {
      key: 'name',
      header: '',
      render: v => <span className="text-fg-muted text-[13px]">{v.name ?? 'Variante'}</span>,
    },
    {
      key: 'sku',
      header: '',
      render: v => v.sku
        ? <span className="font-mono text-xs text-fg-muted">{v.sku}</span>
        : <span className="text-fg-subtle">—</span>,
    },
    { key: 'category', header: '', render: () => <span className="text-fg-subtle">—</span> },
    { key: 'type',     header: '', render: () => <span className="text-fg-subtle">—</span> },
    {
      key: 'price',
      header: '',
      align: 'right',
      render: v => {
        const p = fmtPrice(v.base_price)
        return p ? <span className="tabular-nums text-fg-muted">{p}</span> : <span className="text-fg-subtle">—</span>
      },
    },
    { key: 'stock', header: '', align: 'right', render: v => v.manage_stock
        ? <span className="tabular-nums text-fg-muted">{v.stock_quantity}</span>
        : <span className="text-fg-subtle">—</span>,
    },
    { key: 'woo', header: '', render: () => null },
    { key: 'status',  header: '', render: () => null },
    { key: 'actions', header: '', render: () => null },
    ]
    return showWooColumn ? columns : columns.filter(col => col.key !== 'woo')
  }, [showWooColumn])

  const groups = useMemo<RowGroup<Product, Variant>[]>(
    () => products.map(p => ({ parent: p, children: p.variants })),
    [products],
  )

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Catálogo', href: '/catalogo/productos' }, { label: 'Productos' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setImportSession((session) => session + 1)
                setImportOpen(true)
              }}
            >
              Importar CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExport}>
              Exportar CSV
            </Button>
            <Button
              size="sm"
              data-testid="new-product-btn"
              onClick={() => { setEditing(null); setModalOpen(true) }}
            >
              + Nuevo producto
            </Button>
          </div>
        }
      />
      <CatalogoSubNav />

      <PageBody onRefresh={async () => setRefresh(r => r + 1)}>
        {serverError && (
          <div className="mb-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
            {serverError}
          </div>
        )}
        <GroupedDataTable
          parentColumns={parentColumns}
          childColumns={childColumns}
          groups={groups}
          parentKey={p => p.id}
          childKey={v => v.id}
          getParentRowProps={p => ({
            'data-testid': 'product-row',
            'data-product-name': p.name,
          })}
          onRowClick={p => router.push(`/catalogo/${p.id}`)}
          selection={tableSelection}
          emptyMessage="No hay productos. Creá el primero."
          toolbar={
            <>
              <div className="relative flex items-center w-full sm:w-auto">
                <svg className="absolute left-2 text-fg-subtle pointer-events-none" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/>
                </svg>
                <input
                  type="search"
                  data-testid="product-search-input"
                  placeholder="Buscar por nombre o proveedor…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  className="pl-7 pr-3 h-[30px] text-[13px] border border-border-strong rounded-sm w-full sm:w-56 bg-surface focus:outline-none focus:border-ring"
                />
              </div>
              <select
                data-testid="product-status-filter"
                value={status}
                onChange={e => { setStatus(e.target.value); setPage(1) }}
                className="h-[30px] text-[13px] border border-border-strong rounded-sm px-2 bg-surface focus:outline-none focus:border-ring text-fg-muted"
              >
                <option value="">Todos los estados</option>
                <option value="draft">Borrador</option>
                <option value="active">Activo</option>
                <option value="archived">Archivado</option>
              </select>
              {showWooColumn && (
                <select
                  value={sourceFilter}
                  onChange={e => { setSourceFilter(e.target.value as 'woocommerce' | ''); setPage(1) }}
                  className="h-[30px] text-[13px] border border-border-strong rounded-sm px-2 bg-surface focus:outline-none focus:border-ring text-fg-muted"
                >
                  <option value="">Todos los orígenes</option>
                  <option value="woocommerce">WooCommerce</option>
                </select>
              )}
              {selectedCount > 0 && (
                <>
                  <span className="text-[12px] font-medium text-fg-muted">
                    {selectedCount} seleccionado{selectedCount !== 1 ? 's' : ''}
                  </span>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setBulkDeleteOpen(true)}
                  >
                    Eliminar
                  </Button>
                </>
              )}
              <span className="flex-1" />
              <span className="text-[12px] text-fg-muted">{total} producto{total !== 1 ? 's' : ''}</span>
            </>
          }
          footer={
            total > 0 ? (
              <TablePagination page={page} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
            ) : undefined
          }
        />
      </PageBody>

      {modalOpen && (
        <ProductModal
          product={editing}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            const wasEdit = !!editing
            setModalOpen(false)
            setEditing(null)
            setRefresh((r) => r + 1)
            notifySuccess(wasEdit ? 'Producto actualizado' : 'Producto creado exitosamente')
          }}
        />
      )}

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Eliminar productos"
        description={
          selectedCount === 1
            ? 'Se eliminará 1 producto seleccionado.'
            : `Se eliminarán ${selectedCount} productos seleccionados.`
        }
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleBulkDelete}
      />

      <ConfirmDialog
        open={!!productToDelete}
        onOpenChange={open => { if (!open) setProductToDelete(null) }}
        title="Eliminar producto"
        description={productToDelete ? `Se eliminará ${productToDelete.name}.` : ''}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDeleteProduct}
      />

      <ImportModal
        key={importSession}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importar productos"
        fields={PRODUCT_CSV_HEADERS_FOR_IMPORT}
        savedFieldMaps={savedImportFieldMaps}
        requiredFields={['name']}
        importUrl="/api/v1/catalog/products/import"
        importSource="catalog_csv"
        supportsStreamProgress
        stockWarehouse={{
          options: importWarehouses.map((w) => ({ value: w.id, label: w.name })),
          label: 'Depósito',
        }}
        defaultFillFields={CATALOG_IMPORT_DEFAULT_FIELDS}
        onImported={async (_result, effectiveMapping) => {
          notifySuccess('Productos importados correctamente')
          if (effectiveMapping && Object.keys(effectiveMapping).length > 0) {
            try {
              await fetch('/api/v1/catalog/import-field-maps', {
                method: 'PUT',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  profile: null,
                  maps: Object.entries(effectiveMapping).map(([internal_field_key, external_header]) => ({
                    internal_field_key,
                    external_header,
                  })),
                }),
              })
            } catch {
              /* el import ya se aplicó; el guardado del mapa es opcional */
            }
          }
          setRefresh((value) => value + 1)
          setImportOpen(false)
        }}
      />
    </div>
  )
}
