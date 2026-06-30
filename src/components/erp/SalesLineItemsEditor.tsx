'use client'

import { useRef, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/primitives/Button'
import { CurrencyInput } from '@/components/primitives/CurrencyInput'
import { SearchableSelect } from '@/components/erp/SearchableSelect'
import type { SearchableSelectOption } from '@/components/erp/SearchableSelect'
import type { IvaRate } from '@/types'
import { fetchJson } from '@/lib/fetch-json'
import {
  formatBranchStockLabel,
  type BranchStockMap,
} from '@/lib/sales-line-items-form'

export interface LineItemInput {
  id: string
  product_id: string | null
  variant_id: string | null
  description: string
  quantity: string
  unit_price: string
  discount_pct: string
  iva_rate: IvaRate
}

export interface SalesLineItemsEditorProps {
  items: LineItemInput[]
  onChange: (items: LineItemInput[]) => void
  priceListId?: string | null
  branchId?: string | null
  onStockMapChange?: (map: BranchStockMap) => void
  disabled?: boolean
}

type SaleProduct = {
  product_id: string
  variant_id: string
  name: string
  sku: string
  iva_rate: string
  price: string
}

type BranchStockRow = {
  variant_id: string
  quantity: string
  manage_stock: boolean
}

const IVA_OPTIONS: { value: IvaRate; label: string }[] = [
  { value: '0',    label: '0%' },
  { value: '10.5', label: '10.5%' },
  { value: '21',   label: '21%' },
  { value: '27',   label: '27%' },
]

export function makeEmptyLine(): LineItemInput {
  return {
    id:           crypto.randomUUID(),
    product_id:   null,
    variant_id:   null,
    description:  '',
    quantity:     '1',
    unit_price:   '0',
    discount_pct: '0',
    iva_rate:     '21',
  }
}

export function calcLine(item: LineItemInput) {
  const qty      = parseFloat(item.quantity)     || 0
  const price    = parseFloat(item.unit_price)   || 0
  const discPct  = parseFloat(item.discount_pct) || 0
  const iva      = parseFloat(item.iva_rate)      || 0
  const subtotal       = qty * price
  const discountAmount = subtotal * discPct / 100
  const taxBase        = subtotal - discountAmount
  const taxAmount      = taxBase * iva / 100
  const total          = taxBase + taxAmount
  return { subtotal, discountAmount, taxBase, taxAmount, total }
}

export function calcTotals(items: LineItemInput[]) {
  let subtotal = 0, discountAmount = 0, taxAmount = 0, total = 0
  const rateMap: Record<string, { base: number; amount: number }> = {}
  for (const item of items) {
    const c = calcLine(item)
    subtotal       += c.subtotal
    discountAmount += c.discountAmount
    taxAmount      += c.taxAmount
    total          += c.total
    const rate = item.iva_rate
    if (!rateMap[rate]) rateMap[rate] = { base: 0, amount: 0 }
    rateMap[rate].base   += c.taxBase
    rateMap[rate].amount += c.taxAmount
  }
  const taxBreakdown = Object.entries(rateMap)
    .filter(([, v]) => v.amount > 0)
    .map(([rate, v]) => ({ rate, base: v.base.toFixed(2), amount: v.amount.toFixed(2) }))
  return {
    subtotal:       subtotal.toFixed(2),
    discountAmount: discountAmount.toFixed(2),
    taxAmount:      taxAmount.toFixed(2),
    total:          total.toFixed(2),
    taxBreakdown,
  }
}

function computeOverstockLines(items: LineItemInput[], stockByVariant: BranchStockMap): Set<number> {
  const over = new Set<number>()
  const demandByVariant = new Map<string, { total: number; lineIndexes: number[] }>()

  items.forEach((item, index) => {
    if (!item.variant_id) return
    const stock = stockByVariant[item.variant_id]
    if (!stock?.manage_stock) return
    const qty = parseFloat(item.quantity) || 0
    if (qty <= 0) return
    const prev = demandByVariant.get(item.variant_id)
    if (prev) {
      prev.total += qty
      prev.lineIndexes.push(index)
    } else {
      demandByVariant.set(item.variant_id, { total: qty, lineIndexes: [index] })
    }
  })

  for (const [variantId, demand] of demandByVariant) {
    const available = stockByVariant[variantId]?.quantity ?? 0
    if (demand.total > available) {
      for (const index of demand.lineIndexes) over.add(index)
    }
  }

  return over
}

interface ProductCellProps {
  productId: string | null
  priceListId?: string | null
  disabled?: boolean
  onSelect: (productId: string | null, product?: SaleProduct) => void
}

function ProductCell({ productId, priceListId, disabled, onSelect }: ProductCellProps) {
  const cacheRef = useRef<SaleProduct[]>([])

  const searchProducts = useCallback(async (q: string): Promise<SearchableSelectOption[]> => {
    const params = new URLSearchParams({ search: q, limit: '20' })
    if (priceListId) params.set('price_list_id', priceListId)
    try {
      const data = await fetchJson<{ data: SaleProduct[] }>(`/api/v1/catalog/products/for-sale?${params}`)
      cacheRef.current = data.data ?? []
    } catch {
      cacheRef.current = []
    }
    return cacheRef.current.map(p => ({
      value:    p.product_id,
      label:    p.name,
      sublabel: p.sku,
    }))
  }, [priceListId])

  function handleChange(value: string | null) {
    if (!value) { onSelect(null); return }
    const found = cacheRef.current.find(p => p.product_id === value)
    onSelect(value, found)
  }

  return (
    <SearchableSelect
      value={productId}
      onChange={handleChange}
      onSearch={searchProducts}
      placeholder="Buscar producto…"
      disabled={disabled}
      clearable
    />
  )
}

export function SalesLineItemsEditor({
  items,
  onChange,
  priceListId,
  branchId,
  onStockMapChange,
  disabled,
}: SalesLineItemsEditorProps) {
  const [stockByVariant, setStockByVariant] = useState<BranchStockMap>({})

  const variantIds = useMemo(
    () => [...new Set(items.map((item) => item.variant_id).filter((id): id is string => Boolean(id)))],
    [items],
  )
  const variantIdsKey = variantIds.join(',')

  const onStockMapChangeRef = useRef(onStockMapChange)
  useEffect(() => {
    onStockMapChangeRef.current = onStockMapChange
  }, [onStockMapChange])

  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const prevPriceListIdRef = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (variantIds.length === 0) return

    if (prevPriceListIdRef.current === undefined) {
      prevPriceListIdRef.current = priceListId ?? null
      return
    }
    if (prevPriceListIdRef.current === (priceListId ?? null)) return
    prevPriceListIdRef.current = priceListId ?? null

    let cancelled = false
    const params = new URLSearchParams({ variant_ids: variantIds.join(',') })
    if (priceListId) params.set('price_list_id', priceListId)

    void fetchJson<{ data: Record<string, string> }>(`/api/v1/catalog/price-lists/effective-prices?${params}`)
      .then((res) => {
        if (cancelled) return
        const prices = res.data ?? {}
        onChangeRef.current(
          itemsRef.current.map((item) => {
            if (!item.variant_id) return item
            const nextPrice = prices[item.variant_id]
            if (!nextPrice) return item
            const current = parseFloat(item.unit_price) || 0
            const next = parseFloat(nextPrice) || 0
            if (current === next) return item
            return { ...item, unit_price: nextPrice }
          }),
        )
      })
      .catch(() => { /* keep current prices on fetch failure */ })

    return () => { cancelled = true }
  }, [priceListId, variantIdsKey, variantIds])

  useEffect(() => {
    if (!branchId || variantIds.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stock when branch or lines change
      setStockByVariant({})
      onStockMapChangeRef.current?.({})
      return
    }

    let cancelled = false
    const params = new URLSearchParams({
      branch_id: branchId,
      variant_ids: variantIds.join(','),
    })

    void fetchJson<{ data: BranchStockRow[] }>(`/api/v1/sales/branch-stock?${params}`)
      .then((res) => {
        if (cancelled) return
        const map: BranchStockMap = {}
        for (const row of res.data ?? []) {
          map[row.variant_id] = {
            quantity: parseFloat(row.quantity) || 0,
            manage_stock: row.manage_stock,
          }
        }
        setStockByVariant(map)
        onStockMapChangeRef.current?.(map)
      })
      .catch(() => {
        if (cancelled) return
        setStockByVariant({})
        onStockMapChangeRef.current?.({})
      })

    return () => { cancelled = true }
  }, [branchId, variantIds])

  const overstockLines = useMemo(
    () => computeOverstockLines(items, stockByVariant),
    [items, stockByVariant],
  )

  const showStock = Boolean(branchId)

  function updateItem(id: string, patch: Partial<LineItemInput>) {
    onChange(items.map(i => i.id === id ? { ...i, ...patch } : i))
  }

  function handleProductSelect(itemId: string, productId: string | null, product?: SaleProduct) {
    if (!productId || !product) {
      updateItem(itemId, { product_id: productId ?? null, variant_id: null })
      return
    }
    updateItem(itemId, {
      product_id:  productId,
      variant_id:  product.variant_id,
      description: product.name,
      unit_price:  product.price,
      iva_rate:    (product.iva_rate as IvaRate) || '21',
    })
  }

  function addLine() {
    onChange([...items, makeEmptyLine()])
  }

  function removeLine(id: string) {
    if (items.length > 1) onChange(items.filter(i => i.id !== id))
  }

  function renderStockLabel(item: LineItemInput, lineIndex: number) {
    if (!showStock || !item.variant_id) return null
    const stock = stockByVariant[item.variant_id]
    if (!stock) return <span className="text-[10px] text-fg-subtle">Stock: …</span>
    if (!stock.manage_stock) {
      return <span className="text-[10px] text-fg-subtle">Sin control de stock</span>
    }
    const over = overstockLines.has(lineIndex)
    return (
      <span className={`text-[10px] tabular-nums ${over ? 'text-danger font-medium' : 'text-fg-muted'}`}>
        Stock: {formatBranchStockLabel(stock.quantity)}
      </span>
    )
  }

  return (
    <div>
      <p className="text-[11px] font-semibold text-fg-muted uppercase tracking-wide mb-2">
        Ítems
      </p>
      {showStock && overstockLines.size > 0 && (
        <p className="text-[12px] text-danger mb-2">
          Hay ítems sin stock suficiente en la sucursal.{' '}
          <Link href="/inventario/transferencias" className="underline underline-offset-2">
            Hacé una transferencia
          </Link>{' '}
          antes de guardar.
        </p>
      )}
      <div className="border border-border rounded-sm overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-surface-muted border-b border-border">
              <th className="px-2 py-2 text-left font-medium text-fg-muted w-[22%]">Producto</th>
              <th className="px-2 py-2 text-left font-medium text-fg-muted">Descripción</th>
              {showStock && (
                <th className="px-2 py-2 text-right font-medium text-fg-muted w-20">Stock</th>
              )}
              <th className="px-2 py-2 text-right font-medium text-fg-muted w-14">Cant.</th>
              <th className="px-2 py-2 text-right font-medium text-fg-muted w-28">P. unitario</th>
              <th className="px-2 py-2 text-right font-medium text-fg-muted w-16">Desc %</th>
              <th className="px-2 py-2 text-right font-medium text-fg-muted w-16">IVA</th>
              <th className="px-2 py-2 text-right font-medium text-fg-muted w-24">Total</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, lineIndex) => {
              const c = calcLine(item)
              const over = overstockLines.has(lineIndex)
              return (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="px-2 py-1">
                    <div className="flex flex-col gap-0.5">
                      <ProductCell
                        productId={item.product_id}
                        priceListId={priceListId}
                        disabled={disabled}
                        onSelect={(productId, product) => handleProductSelect(item.id, productId, product)}
                      />
                    </div>
                  </td>
                  <td className="px-2 py-1">
                    <input
                      className="w-full h-7 text-[12px] bg-transparent border-0 focus:outline-none focus:bg-surface focus:border focus:border-ring focus:rounded-sm px-1 disabled:text-fg-muted"
                      placeholder="Descripción del ítem"
                      value={item.description}
                      onChange={e => updateItem(item.id, { description: e.target.value })}
                      disabled={disabled}
                    />
                  </td>
                  {showStock && (
                    <td className="px-2 py-1 text-right align-top pt-2">
                      {renderStockLabel(item, lineIndex)}
                    </td>
                  )}
                  <td className="px-2 py-1">
                    <input
                      className={`w-full h-7 text-[12px] text-right bg-transparent border-0 focus:outline-none focus:bg-surface focus:border focus:border-ring focus:rounded-sm px-1 disabled:text-fg-muted ${over ? 'text-danger font-medium' : ''}`}
                      value={item.quantity}
                      onChange={e => updateItem(item.id, { quantity: e.target.value })}
                      inputMode="decimal"
                      disabled={disabled}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <CurrencyInput
                      className="h-7 text-[12px] text-right"
                      value={item.unit_price}
                      onChange={v => updateItem(item.id, { unit_price: v })}
                      disabled={disabled}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      className="w-full h-7 text-[12px] text-right bg-transparent border-0 focus:outline-none focus:bg-surface focus:border focus:border-ring focus:rounded-sm px-1 disabled:text-fg-muted"
                      value={item.discount_pct}
                      onChange={e => updateItem(item.id, { discount_pct: e.target.value })}
                      inputMode="decimal"
                      disabled={disabled}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <select
                      className="w-full h-7 text-[12px] bg-transparent border-0 focus:outline-none text-right disabled:text-fg-muted"
                      value={item.iva_rate}
                      onChange={e => updateItem(item.id, { iva_rate: e.target.value as IvaRate })}
                      disabled={disabled}
                    >
                      {IVA_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums font-medium text-fg-muted">
                    ${c.total.toFixed(2)}
                  </td>
                  <td className="px-1 py-1">
                    <button
                      type="button"
                      onClick={() => removeLine(item.id)}
                      disabled={disabled || items.length === 1}
                      className="p-1 text-fg-subtle hover:text-danger disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      aria-label="Eliminar ítem"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M3 3l10 10M13 3L3 13"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!disabled && (
        <Button type="button" variant="ghost" size="xs" className="mt-2" onClick={addLine}>
          + Agregar ítem
        </Button>
      )}
    </div>
  )
}
