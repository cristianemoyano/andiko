'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { DataTable, type Column } from '@/components/erp'
import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifyApiError, notifySuccess } from '@/lib/notify'

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
}

type PriceListItem = {
  id: string
  price: string
  valid_from: string
  variant: Variant
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

const ITEMS_COLUMNS: Column<PriceListItem>[] = [
  {
    key: 'sku',
    header: 'SKU',
    render: row => <span className="font-mono text-xs">{row.variant?.sku ?? '—'}</span>,
  },
  {
    key: 'name',
    header: 'Variante',
    render: row => row.variant?.name ?? <span className="text-fg-subtle">—</span>,
  },
  {
    key: 'price',
    header: 'Precio',
    align: 'right',
    render: row => (
      <span className="tabular-nums">
        ${Number(row.price).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
      </span>
    ),
  },
  {
    key: 'valid_from',
    header: 'Vigencia',
    render: row => new Date(row.valid_from).toLocaleDateString('es-AR'),
  },
  {
    key: 'actions',
    header: '',
    align: 'right',
    render: row => <RemoveItemButton priceListItemId={row.id} />,
  },
]

function RemoveItemButton({ priceListItemId }: { priceListItemId: string }) {
  const [removing, setRemoving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function handleRemove() {
    setRemoving(true)
    try {
      await fetchJson(
        `/api/v1/catalog/price-lists/${encodeURIComponent(priceListIdFromPath())}/items/${priceListItemId}`,
        { method: 'DELETE' },
      )
      setConfirmOpen(false)
      notifySuccess('Ítem quitado de la lista')
      location.reload()
    } catch (e) {
      notifyApiError(e)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="secondary" disabled={removing} onClick={() => setConfirmOpen(true)}>
        {removing ? 'Quitando…' : 'Quitar'}
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

function priceListIdFromPath(): string {
  const parts = location.pathname.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? ''
}

export function PriceListDetailClient({ priceList }: { priceList: PriceList }) {
  const [items, setItems] = useState<PriceListItem[]>([])
  const [loadingItems, setLoadingItems] = useState(true)

  const [skuQuery, setSkuQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<ProductRow[]>([])

  const [selectedVariantId, setSelectedVariantId] = useState<string>('')
  const [price, setPrice] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDeleteList, setConfirmDeleteList] = useState(false)
  const searchAbortRef = useRef<AbortController | null>(null)

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

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoadingItems(true)
      try {
        const data = await fetchJson<PriceListItem[]>(`/api/v1/catalog/price-lists/${priceList.id}/items`)
        if (mounted) setItems(Array.isArray(data) ? data : [])
      } catch (e) {
        if (mounted) {
          setItems([])
          notifyApiError(e)
        }
      } finally {
        if (mounted) setLoadingItems(false)
      }
    })()
    return () => { mounted = false }
  }, [priceList.id])

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
      await fetchJson(`/api/v1/catalog/price-lists/${priceList.id}/items`, {
        method: 'POST',
        body: JSON.stringify({ product_variant_id: selectedVariantId, price }),
      })
      setPrice('')
      setSelectedVariantId('')
      notifySuccess('Precio agregado a la lista')
      setLoadingItems(true)
      const reloadData = await fetchJson<PriceListItem[]>(`/api/v1/catalog/price-lists/${priceList.id}/items`)
      setItems(Array.isArray(reloadData) ? reloadData : [])
    } catch (e) {
      setFormError(getApiErrorMessage(e))
    } finally {
      setLoadingItems(false)
      setSaving(false)
    }
  }

  async function handleDeleteList() {
    try {
      await fetchJson(`/api/v1/catalog/price-lists/${priceList.id}`, { method: 'DELETE' })
      setConfirmDeleteList(false)
      notifySuccess('Lista eliminada')
      window.location.assign('/catalogo/listas-de-precios')
    } catch (e) {
      setConfirmDeleteList(false)
      notifyApiError(e)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="bg-surface border border-border rounded-sm p-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-fg truncate">{priceList.name}</h1>
            {priceList.is_default && <Badge status="info">Predeterminada</Badge>}
            <Badge status={priceList.is_active ? 'success' : 'neutral'}>
              {priceList.is_active ? 'Activa' : 'Inactiva'}
            </Badge>
          </div>
          {priceList.description && <p className="text-xs text-fg-muted mt-1">{priceList.description}</p>}
        </div>
        <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteList(true)}>
          Eliminar lista
        </Button>
      </div>

      <div className="bg-surface border border-border rounded-sm p-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider">Cargar / actualizar precio</p>
            <p className="text-xs text-fg-subtle mt-1">Tipeá un SKU (o nombre/proveedor) y seleccioná una sugerencia.</p>
          </div>
        </div>

        <form onSubmit={handleSetPrice} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4 items-end">
          <div className="sm:col-span-2">
            <FormField label="SKU" htmlFor="pl_sku">
              <Input
                id="pl_sku"
                placeholder={searching ? 'Buscando…' : 'Ej: RES-A4-500'}
                value={skuQuery}
                onChange={(e) => {
                  const v = e.target.value.toUpperCase()
                  setSkuQuery(v)
                  if (!v) {
                    setResults([])
                    setSelectedVariantId('')
                    setSearching(false)
                    searchAbortRef.current?.abort()
                    searchAbortRef.current = null
                    return
                  }
                  const hit = variantBySku.get(v)
                  setSelectedVariantId(hit?.id ?? '')
                }}
                list="pl_sku_list"
              />
            </FormField>
            <datalist id="pl_sku_list">
              {variants.map(v => (
                <option key={v.id} value={v.sku}>
                  {v.productName}{v.vendor ? ` (${v.vendor})` : ''}
                </option>
              ))}
            </datalist>
          </div>
          <div>
            <FormField label="Precio" htmlFor="pl_price" error={formError ?? undefined}>
              <Input
                id="pl_price"
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                error={!!formError}
                placeholder="0.00"
              />
            </FormField>
          </div>
          <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
            <Button size="sm" type="submit" disabled={saving || !selectedVariantId || !price}>
              {saving ? 'Guardando…' : 'Guardar precio'}
            </Button>
          </div>
        </form>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider">Precios cargados</p>
        </div>
        <DataTable
          columns={ITEMS_COLUMNS}
          data={loadingItems ? [] : items}
          keyExtractor={(row) => row.id}
          emptyMessage={loadingItems ? 'Cargando…' : 'No hay precios cargados para esta lista.'}
        />
      </div>

      <ConfirmDialog
        open={confirmDeleteList}
        onOpenChange={setConfirmDeleteList}
        title="Eliminar lista de precios"
        description={`Se eliminará ${priceList.name}.`}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDeleteList}
      />
    </div>
  )
}

