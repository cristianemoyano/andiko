'use client'

import { useRef, useCallback } from 'react'
import { Button } from '@/components/primitives/Button'
import { CurrencyInput } from '@/components/primitives/CurrencyInput'
import { SearchableSelect } from '@/components/erp/SearchableSelect'
import type { SearchableSelectOption } from '@/components/erp/SearchableSelect'
import type { IvaRate } from '@/types'

export interface LineItemInput {
  id: string
  product_id: string | null
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
  disabled?: boolean
}

type SaleProduct = {
  product_id: string
  name: string
  sku: string
  iva_rate: string
  price: string
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
    const res = await fetch(`/api/v1/catalog/products/for-sale?${params}`)
    const data = await res.json() as { data: SaleProduct[] }
    cacheRef.current = data.data ?? []
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

export function SalesLineItemsEditor({ items, onChange, priceListId, disabled }: SalesLineItemsEditorProps) {
  function updateItem(id: string, patch: Partial<LineItemInput>) {
    onChange(items.map(i => i.id === id ? { ...i, ...patch } : i))
  }

  function handleProductSelect(itemId: string, productId: string | null, product?: SaleProduct) {
    if (!productId || !product) {
      updateItem(itemId, { product_id: productId ?? null })
      return
    }
    updateItem(itemId, {
      product_id:  productId,
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

  return (
    <div>
      <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-2">
        Ítems
      </p>
      <div className="border border-zinc-200 rounded-sm overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="px-2 py-2 text-left font-medium text-zinc-600 w-[22%]">Producto</th>
              <th className="px-2 py-2 text-left font-medium text-zinc-600">Descripción</th>
              <th className="px-2 py-2 text-right font-medium text-zinc-600 w-14">Cant.</th>
              <th className="px-2 py-2 text-right font-medium text-zinc-600 w-28">P. unitario</th>
              <th className="px-2 py-2 text-right font-medium text-zinc-600 w-16">Desc %</th>
              <th className="px-2 py-2 text-right font-medium text-zinc-600 w-16">IVA</th>
              <th className="px-2 py-2 text-right font-medium text-zinc-600 w-24">Total</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              const c = calcLine(item)
              return (
                <tr key={item.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-2 py-1">
                    <ProductCell
                      productId={item.product_id}
                      priceListId={priceListId}
                      disabled={disabled}
                      onSelect={(productId, product) => handleProductSelect(item.id, productId, product)}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      className="w-full h-7 text-[12px] bg-transparent border-0 focus:outline-none focus:bg-white focus:border focus:border-blue-300 focus:rounded-sm px-1 disabled:text-zinc-500"
                      placeholder="Descripción del ítem"
                      value={item.description}
                      onChange={e => updateItem(item.id, { description: e.target.value })}
                      disabled={disabled}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      className="w-full h-7 text-[12px] text-right bg-transparent border-0 focus:outline-none focus:bg-white focus:border focus:border-blue-300 focus:rounded-sm px-1 disabled:text-zinc-500"
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
                      className="w-full h-7 text-[12px] text-right bg-transparent border-0 focus:outline-none focus:bg-white focus:border focus:border-blue-300 focus:rounded-sm px-1 disabled:text-zinc-500"
                      value={item.discount_pct}
                      onChange={e => updateItem(item.id, { discount_pct: e.target.value })}
                      inputMode="decimal"
                      disabled={disabled}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <select
                      className="w-full h-7 text-[12px] bg-transparent border-0 focus:outline-none text-right disabled:text-zinc-500"
                      value={item.iva_rate}
                      onChange={e => updateItem(item.id, { iva_rate: e.target.value as IvaRate })}
                      disabled={disabled}
                    >
                      {IVA_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums font-medium text-zinc-700">
                    ${c.total.toFixed(2)}
                  </td>
                  <td className="px-1 py-1">
                    <button
                      type="button"
                      onClick={() => removeLine(item.id)}
                      disabled={disabled || items.length === 1}
                      className="p-1 text-zinc-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
