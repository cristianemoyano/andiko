'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, EmptyState, TablePagination, type Column } from '@/components/erp'
import { PageBody } from '@/components/layout'
import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Dialog } from '@/components/primitives/Dialog'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/primitives/DropdownMenu'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { PriceListDefaultHint } from '@/components/erp/PriceListDefaultHint'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifyApiError, notifySuccess } from '@/lib/notify'
import { variantDisplayName } from '@/modules/catalog/product.utils'

type PriceList = {
  id: string
  name: string
  description: string | null
  is_default: boolean
  is_active: boolean
}

type Variant = {
  id: string
  sku: string
  name: string | null
  base_price: string | null
  product_id: string
  product?: { id: string; name: string } | null
}

type PriceListItem = {
  id: string
  price: string
  valid_from: string
  created_at: string
  updated_at: string
  variant: Variant
}

type Category = { id: string; name: string }

type FillPreview = {
  added: number
  skipped_existing: number
  skipped_no_price: number
  total_active_variants: number
}

const PAGE_SIZE = 50

function formatItemTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type ProductRow = {
  id: string
  name: string
  vendor: string | null
  variants: Array<{
    id: string
    sku: string
    base_price: string | null
  }>
}

const ITEMS_COLUMNS = (
  priceListId: string,
  onRemoved: () => void,
): Column<PriceListItem>[] => [
  {
    key: 'sku',
    header: 'SKU',
    mobileRole: 'subtitle',
    render: row => <span className="font-mono text-xs text-fg-muted">{row.variant?.sku ?? '—'}</span>,
  },
  {
    key: 'name',
    header: 'Producto',
    mobileRole: 'title',
    render: row => {
      const label = row.variant
        ? variantDisplayName(row.variant.product?.name ?? '', row.variant.name)
        : ''
      return label
        ? <span className="text-fg">{label}</span>
        : <span className="text-fg-subtle">—</span>
    },
  },
  {
    key: 'price',
    header: 'Precio',
    align: 'right',
    mobileRole: 'amount',
    render: row => (
      <span className="tabular-nums font-medium">
        ${Number(row.price).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
      </span>
    ),
  },
  {
    key: 'created_at',
    header: 'Agregado',
    mobileRole: 'hidden',
    className: 'whitespace-nowrap',
    render: row => (
      <span className="text-[12px] text-fg-muted tabular-nums">{formatItemTimestamp(row.created_at)}</span>
    ),
  },
  {
    key: 'updated_at',
    header: 'Actualizado',
    mobileRole: 'hidden',
    className: 'whitespace-nowrap',
    render: row => (
      <span className="text-[12px] text-fg-muted tabular-nums">{formatItemTimestamp(row.updated_at)}</span>
    ),
  },
  {
    key: 'actions',
    header: '',
    align: 'right',
    mobileRole: 'actions',
    className: 'w-12',
    render: row => (
      <RemoveItemButton
        priceListId={priceListId}
        priceListItemId={row.id}
        onRemoved={onRemoved}
      />
    ),
  },
]

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

function RemoveItemButton({
  priceListId,
  priceListItemId,
  onRemoved,
}: {
  priceListId: string
  priceListItemId: string
  onRemoved: () => void
}) {
  const [removing, setRemoving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function handleRemove() {
    setRemoving(true)
    try {
      await fetchJson(
        `/api/v1/catalog/price-lists/${encodeURIComponent(priceListId)}/items/${priceListItemId}`,
        { method: 'DELETE' },
      )
      setConfirmOpen(false)
      notifySuccess('Precio quitado de la lista')
      onRemoved()
    } catch (e) {
      notifyApiError(e)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <>
      <Button
        size="xs"
        variant="ghost"
        disabled={removing}
        onClick={() => setConfirmOpen(true)}
        aria-label="Quitar precio de la lista"
        className="px-2 text-danger hover:text-danger hover:bg-danger/10"
      >
        {removing ? <span className="text-xs">…</span> : <TrashIcon />}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Quitar precio de la lista"
        description="Se eliminará este ítem de la lista."
        confirmLabel="Quitar"
        variant="danger"
        onConfirm={handleRemove}
      />
    </>
  )
}

export function PriceListDetailClient({ priceList: initialPriceList }: { priceList: PriceList }) {
  const router = useRouter()
  const [listMeta, setListMeta] = useState(initialPriceList)
  const [items, setItems] = useState<PriceListItem[]>([])
  const [itemsTotal, setItemsTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loadingItems, setLoadingItems] = useState(true)

  const [skuQuery, setSkuQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<ProductRow[]>([])

  const [selectedVariantId, setSelectedVariantId] = useState<string>('')
  const [price, setPrice] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDeleteList, setConfirmDeleteList] = useState(false)
  const [cloneOpen, setCloneOpen] = useState(false)
  const [cloning, setCloning] = useState(false)
  const [cloneError, setCloneError] = useState<string | null>(null)
  const [cloneForm, setCloneForm] = useState({ name: '', description: '' })
  const [editOpen, setEditOpen] = useState(false)
  const [savingMeta, setSavingMeta] = useState(false)
  const [metaError, setMetaError] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    name: initialPriceList.name,
    description: initialPriceList.description ?? '',
    is_default: initialPriceList.is_default,
    is_active: initialPriceList.is_active,
  })
  const [itemsRefresh, setItemsRefresh] = useState(0)
  const [categories, setCategories] = useState<Category[]>([])
  const [fillOpen, setFillOpen] = useState(false)
  const [fillCategoryId, setFillCategoryId] = useState('')
  const [fillIncludeWithoutPrice, setFillIncludeWithoutPrice] = useState(false)
  const [fillPreview, setFillPreview] = useState<FillPreview | null>(null)
  const [fillLoading, setFillLoading] = useState(false)
  const [fillApplying, setFillApplying] = useState(false)
  const [fillError, setFillError] = useState<string | null>(null)
  const [itemSearch, setItemSearch] = useState('')
  const [itemSearchDebounced, setItemSearchDebounced] = useState('')
  const searchAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setItemSearchDebounced(itemSearch), 250)
    return () => clearTimeout(t)
  }, [itemSearch])

  const itemsColumns = useMemo(
    () => ITEMS_COLUMNS(listMeta.id, () => setItemsRefresh((r) => r + 1)),
    [listMeta.id],
  )

  const variants = useMemo(() => (
    results
      .flatMap(p => p.variants.map(v => ({ productName: p.name, vendor: p.vendor, ...v })))
      .filter(v => v.sku)
  ), [results])

  const variantBySku = useMemo(() => {
    const map = new Map<string, { id: string; productName: string; vendor: string | null }>()
    for (const v of variants) map.set(v.sku, { id: v.id, productName: v.productName, vendor: v.vendor })
    return map
  }, [variants])

  const selectedVariantLabel = useMemo(() => {
    if (!selectedVariantId) return null
    const hit = variants.find((v) => v.id === selectedVariantId)
    return hit ? `${hit.productName} · ${hit.sku}` : null
  }, [selectedVariantId, variants])

  useEffect(() => {
    let mounted = true
    void fetchJson<{ data: Category[] }>('/api/v1/catalog/categories?limit=100')
      .then((r) => { if (mounted) setCategories(r.data ?? []) })
      .catch(() => { if (mounted) setCategories([]) })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoadingItems(true)
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
        })
        if (itemSearchDebounced.trim()) params.set('search', itemSearchDebounced.trim())
        const data = await fetchJson<{
          data?: PriceListItem[]
          total?: number
        }>(`/api/v1/catalog/price-lists/${listMeta.id}/items?${params}`)
        if (mounted) {
          setItems(Array.isArray(data?.data) ? data.data : [])
          setItemsTotal(data?.total ?? 0)
        }
      } catch (e) {
        if (mounted) {
          setItems([])
          setItemsTotal(0)
          notifyApiError(e)
        }
      } finally {
        if (mounted) setLoadingItems(false)
      }
    })()
    return () => { mounted = false }
  }, [listMeta.id, itemsRefresh, page, itemSearchDebounced])

  useEffect(() => {
    const q = skuQuery.trim()
    if (!q) return

    const t = setTimeout(async () => {
      searchAbortRef.current?.abort()
      const abort = new AbortController()
      searchAbortRef.current = abort
      setSearching(true)
      setFormError(null)

      const params = new URLSearchParams({ page: '1', limit: '20', search: q })
      try {
        const payload = await fetchJson<{ data?: ProductRow[] }>(`/api/v1/catalog/products?${params}`, {
          signal: abort.signal,
        })
        setResults(Array.isArray(payload?.data) ? payload.data : [])
        const flat = (Array.isArray(payload?.data) ? payload.data : [])
          .flatMap((p: ProductRow) => p.variants.map(v => ({ ...v, productName: p.name })))
          .filter(v => v.sku)
        if (flat.length === 1) {
          setSelectedVariantId(flat[0]!.id)
        }
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return
        setResults([])
      }
      setSearching(false)
    }, 250)

    return () => clearTimeout(t)
  }, [skuQuery])

  async function handleSetPrice(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)

    try {
      await fetchJson(`/api/v1/catalog/price-lists/${listMeta.id}/items`, {
        method: 'POST',
        body: JSON.stringify({ product_variant_id: selectedVariantId, price }),
      })
      setPrice('')
      setSelectedVariantId('')
      notifySuccess('Precio agregado a la lista')
      setItemsRefresh(r => r + 1)
      setPage(1)
    } catch (e) {
      setFormError(getApiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  function openFillFromCatalog() {
    setFillCategoryId('')
    setFillIncludeWithoutPrice(false)
    setFillPreview(null)
    setFillError(null)
    setFillOpen(true)
  }

  function fillPayload(dryRun: boolean) {
    return {
      ...(fillCategoryId ? { category_id: fillCategoryId } : {}),
      include_without_price: fillIncludeWithoutPrice,
      dry_run: dryRun,
    }
  }

  async function handleFillPreview() {
    setFillLoading(true)
    setFillError(null)
    setFillPreview(null)
    try {
      const result = await fetchJson<FillPreview>(
        `/api/v1/catalog/price-lists/${listMeta.id}/fill-from-catalog`,
        { method: 'POST', body: JSON.stringify(fillPayload(true)) },
      )
      setFillPreview(result)
    } catch (e) {
      setFillError(getApiErrorMessage(e))
    } finally {
      setFillLoading(false)
    }
  }

  async function handleFillApply() {
    setFillApplying(true)
    setFillError(null)
    try {
      const result = await fetchJson<FillPreview>(
        `/api/v1/catalog/price-lists/${listMeta.id}/fill-from-catalog`,
        { method: 'POST', body: JSON.stringify(fillPayload(false)) },
      )
      setFillOpen(false)
      setFillPreview(null)
      if (result.added > 0) {
        notifySuccess(
          result.added === 1
            ? '1 precio agregado desde el catálogo'
            : `${result.added} precios agregados desde el catálogo`,
        )
        setItemsRefresh(r => r + 1)
        setPage(1)
      } else {
        notifySuccess('No había precios nuevos para agregar')
      }
    } catch (e) {
      setFillError(getApiErrorMessage(e))
    } finally {
      setFillApplying(false)
    }
  }

  function openEdit() {
    setEditForm({
      name: listMeta.name,
      description: listMeta.description ?? '',
      is_default: listMeta.is_default,
      is_active: listMeta.is_active,
    })
    setMetaError(null)
    setEditOpen(true)
  }

  async function handleSaveMeta(e: React.FormEvent) {
    e.preventDefault()
    setSavingMeta(true)
    setMetaError(null)
    try {
      const updated = await fetchJson<PriceList>(`/api/v1/catalog/price-lists/${listMeta.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editForm.name.trim(),
          description: editForm.description.trim() || null,
          is_default: editForm.is_default,
          is_active: editForm.is_active,
        }),
      })
      setListMeta(updated)
      setEditOpen(false)
      notifySuccess('Lista actualizada')
      router.refresh()
    } catch (e) {
      setMetaError(getApiErrorMessage(e))
    } finally {
      setSavingMeta(false)
    }
  }

  async function handleDeleteList() {
    try {
      await fetchJson(`/api/v1/catalog/price-lists/${listMeta.id}`, { method: 'DELETE' })
      setConfirmDeleteList(false)
      notifySuccess('Lista eliminada')
      window.location.assign('/catalogo/listas-de-precios')
    } catch (e) {
      setConfirmDeleteList(false)
      notifyApiError(e)
    }
  }

  function openClone() {
    setCloneForm({
      name: `${listMeta.name} (copia)`,
      description: listMeta.description ?? '',
    })
    setCloneError(null)
    setCloneOpen(true)
  }

  async function handleClone(e: React.FormEvent) {
    e.preventDefault()
    setCloning(true)
    setCloneError(null)
    try {
      const created = await fetchJson<{ id: string; items_copied: number }>(
        `/api/v1/catalog/price-lists/${listMeta.id}/clone`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: cloneForm.name,
            description: cloneForm.description || null,
          }),
        },
      )
      setCloneOpen(false)
      notifySuccess(
        created.items_copied > 0
          ? `Lista clonada con ${created.items_copied} precios`
          : 'Lista clonada (sin precios en el origen)',
      )
      router.push(`/catalogo/listas-de-precios/${created.id}`)
    } catch (err) {
      setCloneError(getApiErrorMessage(err))
    } finally {
      setCloning(false)
    }
  }

  return (
    <PageBody padding="p-6" className="flex flex-col gap-6">
      {listMeta.is_default && <PriceListDefaultHint className="mb-4" />}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-fg tracking-tight">{listMeta.name}</h1>
            {listMeta.is_default && <Badge status="info">Predeterminada</Badge>}
            <Badge status={listMeta.is_active ? 'success' : 'neutral'}>
              {listMeta.is_active ? 'Activa' : 'Inactiva'}
            </Badge>
          </div>
          {listMeta.description ? (
            <div className="mt-3 max-w-2xl border-l-2 border-brand-200 pl-3">
              <p className="text-[13px] leading-relaxed text-fg-muted">
                {listMeta.description}
              </p>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" onClick={openFillFromCatalog}>
            Agregar desde catálogo
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" aria-label="Más acciones" className="px-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={openEdit}>Editar lista</DropdownMenuItem>
              <DropdownMenuItem onSelect={openClone}>Clonar lista</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDeleteList(true)}>
                Eliminar lista
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-col gap-5">
      <div className="rounded border border-border bg-surface p-4 shadow-sm">
        <form onSubmit={handleSetPrice} className="flex flex-col gap-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end">
            <FormField label="Buscar por SKU o nombre" htmlFor="pl_sku">
              <Input
                id="pl_sku"
                placeholder={searching ? 'Buscando…' : 'Ej: RES-A4 o nombre del producto'}
                value={skuQuery}
                onChange={(e) => {
                  const v = e.target.value
                  setSkuQuery(v)
                  if (!v.trim()) {
                    setResults([])
                    setSelectedVariantId('')
                    setSearching(false)
                    searchAbortRef.current?.abort()
                    searchAbortRef.current = null
                    return
                  }
                  const hit = variantBySku.get(v.trim().toUpperCase())
                  setSelectedVariantId(hit?.id ?? '')
                }}
                list="pl_sku_list"
              />
            </FormField>
            <FormField label="Precio" htmlFor="pl_price" error={formError ?? undefined}>
              <Input
                id="pl_price"
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                error={!!formError}
                placeholder="0,00"
              />
            </FormField>
            <Button size="sm" type="submit" className="w-full sm:w-auto" disabled={saving || !selectedVariantId || !price}>
              {saving ? '…' : 'Agregar precio'}
            </Button>
          </div>
          <datalist id="pl_sku_list">
            {variants.map(v => (
              <option key={v.id} value={v.sku}>
                {v.productName}{v.vendor ? ` (${v.vendor})` : ''}
              </option>
            ))}
          </datalist>
          {selectedVariantLabel && (
            <p className="text-[13px] leading-snug text-fg-muted truncate" title={selectedVariantLabel}>
              <span className="font-medium text-fg">Seleccionado:</span>{' '}
              {selectedVariantLabel}
            </p>
          )}
        </form>
      </div>

      <section className="min-w-0">
          {!loadingItems && itemsTotal === 0 && !itemSearchDebounced.trim() ? (
            <div className="rounded border border-border bg-surface shadow-sm">
              <EmptyState
                title="Esta lista no tiene precios todavía"
                description="Usá «Agregar desde catálogo» arriba a la derecha, o buscá un producto en el formulario y cargá su precio."
                action={{ label: 'Agregar desde catálogo', onClick: openFillFromCatalog }}
                icon={(
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-fg-subtle">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              />
            </div>
          ) : (
            <DataTable
              columns={itemsColumns}
              data={loadingItems ? [] : items}
              keyExtractor={(row) => row.id}
              stickyFirstColumn
              emptyMessage={
                loadingItems
                  ? 'Cargando precios…'
                  : itemSearchDebounced.trim()
                    ? 'Ningún precio coincide con la búsqueda.'
                    : 'No hay precios cargados.'
              }
              toolbar={
                <div className="flex flex-col gap-3 w-full sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 shrink-0">
                    <h2 className="text-[13px] font-semibold text-fg">Precios cargados</h2>
                    <p className="mt-0.5 text-[12px] text-fg-muted tabular-nums">
                      {loadingItems
                        ? 'Cargando…'
                        : itemSearchDebounced.trim()
                          ? `${items.length.toLocaleString('es-AR')} de ${itemsTotal.toLocaleString('es-AR')} coincidencias`
                          : `${itemsTotal.toLocaleString('es-AR')} precio${itemsTotal !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <div className="relative flex items-center w-full sm:w-auto flex-1 sm:max-w-xs sm:justify-end">
                    <svg className="absolute left-2 text-fg-subtle pointer-events-none" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5l3 3" />
                    </svg>
                    <input
                      type="search"
                      placeholder="Buscar por SKU o nombre…"
                      value={itemSearch}
                      onChange={e => { setItemSearch(e.target.value); setPage(1) }}
                      className="pl-7 pr-3 h-[30px] text-[13px] border border-border-strong rounded-sm w-full bg-surface focus:outline-none focus:border-ring"
                    />
                  </div>
                </div>
              }
              footer={
                itemsTotal > 0 ? (
                  <TablePagination
                    page={page}
                    pageSize={PAGE_SIZE}
                    total={itemsTotal}
                    onPageChange={setPage}
                  />
                ) : null
              }
            />
          )}
      </section>
      </div>

      <ConfirmDialog
        open={confirmDeleteList}
        onOpenChange={setConfirmDeleteList}
        title="Eliminar lista de precios"
        description={`Se eliminará ${listMeta.name}.`}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDeleteList}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="Editar lista de precios" size="sm">
        <form onSubmit={handleSaveMeta} className="flex flex-col gap-4">
          {metaError && (
            <div className="text-xs text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">
              {metaError}
            </div>
          )}
          <FormField label="Nombre *" htmlFor="edit_price_list_name">
            <Input
              id="edit_price_list_name"
              value={editForm.name}
              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
              required
            />
          </FormField>
          <FormField label="Descripción" htmlFor="edit_price_list_description">
            <Input
              id="edit_price_list_description"
              value={editForm.description}
              onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Opcional"
            />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-fg-muted cursor-pointer">
            <input
              type="checkbox"
              checked={editForm.is_default}
              onChange={e => setEditForm(f => ({ ...f, is_default: e.target.checked }))}
              className="accent-brand-600"
            />
            Marcar como lista predeterminada
          </label>
          {editForm.is_default && <PriceListDefaultHint compact />}
          <label className="flex items-center gap-2 text-sm text-fg-muted cursor-pointer">
            <input
              type="checkbox"
              checked={editForm.is_active}
              onChange={e => setEditForm(f => ({ ...f, is_active: e.target.checked }))}
              className="accent-brand-600"
            />
            Lista activa
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={savingMeta || !editForm.name.trim()}>
              {savingMeta ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={cloneOpen} onOpenChange={setCloneOpen} title="Clonar lista de precios" size="sm">
        <form onSubmit={handleClone} className="flex flex-col gap-4">
          <p className="text-xs text-fg-muted">
            Se copiarán todos los precios de <span className="font-medium text-fg">{listMeta.name}</span> a una lista nueva.
          </p>
          {cloneError && (
            <div className="text-xs text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">
              {cloneError}
            </div>
          )}
          <FormField label="Nombre de la nueva lista *" htmlFor="clone_detail_name">
            <Input
              id="clone_detail_name"
              value={cloneForm.name}
              onChange={e => setCloneForm(f => ({ ...f, name: e.target.value }))}
              required
            />
          </FormField>
          <FormField label="Descripción" htmlFor="clone_detail_description">
            <Input
              id="clone_detail_description"
              value={cloneForm.description}
              onChange={e => setCloneForm(f => ({ ...f, description: e.target.value }))}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setCloneOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={cloning || !cloneForm.name.trim()}>
              {cloning ? 'Clonando…' : 'Clonar lista'}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={fillOpen} onOpenChange={setFillOpen} title="Agregar precios desde catálogo" size="sm">
        <div className="flex flex-col gap-4">
          <p className="text-xs text-fg-muted leading-relaxed">
            Agrega a esta lista las variantes de productos <span className="font-medium text-fg">activos</span> con{' '}
            <span className="font-medium text-fg">precio base</span>. Los productos{' '}
            <span className="font-medium text-fg">sin categoría</span> se incluyen si elegís «Todas las categorías».
            Las variantes que ya estén en la lista no se modifican.
          </p>
          {fillError && (
            <div className="text-xs text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">
              {fillError}
            </div>
          )}
          <FormField label="Categoría" htmlFor="fill_category_id">
            <Select
              id="fill_category_id"
              value={fillCategoryId}
              onChange={(v) => {
                setFillCategoryId(v)
                setFillPreview(null)
              }}
              options={[
                { value: '', label: 'Todas las categorías' },
                ...categories.map(c => ({ value: c.id, label: c.name })),
              ]}
            />
          </FormField>
          <label className="flex items-start gap-2 text-sm text-fg-muted cursor-pointer">
            <input
              type="checkbox"
              checked={fillIncludeWithoutPrice}
              onChange={(e) => {
                setFillIncludeWithoutPrice(e.target.checked)
                setFillPreview(null)
              }}
              className="accent-brand-600 mt-0.5"
            />
            <span>
              Incluir productos sin precio base
              <span className="block text-[11px] text-fg-subtle mt-0.5">
                Se agregarán a la lista con precio $0,00
              </span>
            </span>
          </label>
          {fillPreview && (
            <div className="rounded-sm border border-border bg-surface-muted px-3 py-2.5 text-[12px] text-fg-muted space-y-1">
              <p><span className="font-medium text-fg">{fillPreview.total_active_variants}</span> variantes activas en el catálogo</p>
              <p><span className="font-medium text-fg">{fillPreview.added}</span> precios a agregar</p>
              <p>{fillPreview.skipped_existing} ya en la lista (sin cambios)</p>
              {fillPreview.skipped_no_price > 0 && (
                <p>{fillPreview.skipped_no_price} sin precio base (omitidos)</p>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setFillOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={fillLoading || fillApplying}
              onClick={() => void handleFillPreview()}
            >
              {fillLoading ? 'Calculando…' : 'Vista previa'}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={fillApplying || fillLoading || (fillPreview != null && fillPreview.added === 0)}
              onClick={() => void handleFillApply()}
            >
              {fillApplying ? 'Agregando…' : 'Agregar'}
            </Button>
          </div>
        </div>
      </Dialog>
    </PageBody>
  )
}

