'use client'

import { useState, useEffect, useRef } from 'react'
import Decimal from 'decimal.js'
import { Dialog } from '@/components/primitives/Dialog'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { Button } from '@/components/primitives/Button'
import { DatePicker } from '@/components/primitives/DatePicker'
import { SearchableSelect } from '@/components/erp/SearchableSelect'
import type { SearchableSelectOption } from '@/components/erp/SearchableSelect'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

interface AjusteStockModalProps {
  warehouseId: string
  onClose: () => void
  onSaved: () => void
}

function toIsoDateUtc(d: Date | null): string | null {
  if (!d) return null
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function dateFromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function AjusteStockModal({ warehouseId, onClose, onSaved }: AjusteStockModalProps) {
  const [variantId, setVariantId]     = useState<string | null>(null)
  const [quantity, setQuantity]       = useState('')
  const [minimumQty, setMinimumQty]   = useState('0')
  const [expiresOn, setExpiresOn]     = useState<Date | null>(null)
  const [batchCode, setBatchCode]     = useState('')
  const [batchExpiry, setBatchExpiry] = useState<Date | null>(null)
  const [notes, setNotes]             = useState('')
  const [errors, setErrors]           = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting]   = useState(false)
  const [loadingRow, setLoadingRow]   = useState(false)
  /** Cantidad leída del API al elegir variante; sirve para omitir POST si solo cambian mínimo/vencimiento. */
  const loadedQuantityRef = useRef<string | null>(null)

  useEffect(() => {
    if (!variantId) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset loading before async stock fetch (same pattern as DepositoDetail)
    setLoadingRow(true)
    void (async () => {
      try {
        const data = await fetchJson<{ data: Array<{ quantity: string; minimum_quantity?: string; expires_on?: string | null }> }>(
          `/api/v1/inventory/stock?warehouse_id=${encodeURIComponent(warehouseId)}&variant_id=${encodeURIComponent(variantId)}&page=1&limit=1`,
        )
        const row = (data.data ?? [])[0] as
          | { quantity: string; minimum_quantity?: string; expires_on?: string | null }
          | undefined
        if (cancelled) return
        if (row) {
          const q = row.quantity ?? '0'
          loadedQuantityRef.current = q
          setQuantity(q)
          setMinimumQty(row.minimum_quantity ?? '0')
          setExpiresOn(row.expires_on ? dateFromIso(String(row.expires_on).slice(0, 10)) : null)
        } else {
          loadedQuantityRef.current = '0'
          setQuantity('0')
          setMinimumQty('0')
          setExpiresOn(null)
        }
      } catch {
        if (!cancelled) {
          loadedQuantityRef.current = null
          setQuantity('')
          setMinimumQty('0')
          setExpiresOn(null)
        }
      } finally {
        if (!cancelled) setLoadingRow(false)
      }
    })()
    return () => { cancelled = true }
  }, [variantId, warehouseId])

  async function searchVariants(q: string): Promise<SearchableSelectOption[]> {
    try {
      const data = await fetchJson<{ data: Array<{ variant_id: string; name: string; sku: string }> }>(
        `/api/v1/catalog/products/for-sale?search=${encodeURIComponent(q)}&manage_stock=true&limit=20`,
      )
      return (data.data ?? []).map(p => ({
        value: p.variant_id,
        label: p.name,
        sublabel: p.sku,
      }))
    } catch {
      return []
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!variantId) errs.variant = 'Seleccioná una variante'
    if (!quantity || Number.isNaN(Number(quantity)) || Number(quantity) < 0) errs.quantity = 'Cantidad válida requerida'
    const minN = minimumQty.trim() === '' ? 0 : Number(minimumQty)
    if (minimumQty.trim() !== '' && (Number.isNaN(minN) || minN < 0)) errs.minimum = 'Mínimo inválido'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSubmitting(true)
    setServerError(null)
    try {
      const loaded = loadedQuantityRef.current ?? '0'
      const target = new Decimal(quantity.trim() || '0')
      const qtyUnchanged = target.equals(loaded)
      // Lot only applies when stock is going up (an inbound adjustment).
      const isIncrease = target.greaterThan(loaded)

      if (!qtyUnchanged) {
        try {
          await fetchJson('/api/v1/inventory/movements', {
            method: 'POST',
            body: JSON.stringify({
              variant_id:   variantId,
              warehouse_id: warehouseId,
              quantity:     Number(quantity),
              notes:        notes.trim() || null,
              batch_code:   isIncrease && batchCode.trim() ? batchCode.trim() : null,
              expiry_date:  isIncrease ? toIsoDateUtc(batchExpiry) : null,
            }),
          })
        } catch (e) {
          setServerError(getApiErrorMessage(e))
          return
        }
      }

      try {
        await fetchJson('/api/v1/inventory/stock', {
          method: 'PATCH',
          body: JSON.stringify({
            variant_id:       variantId,
            warehouse_id:     warehouseId,
            minimum_quantity: minN,
            expires_on:       toIsoDateUtc(expiresOn),
          }),
        })
      } catch (e) {
        setServerError(getApiErrorMessage(e))
        return
      }
      onSaved()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={open => { if (!open) onClose() }}
      title="Cargar o ajustar stock"
      description="Elegí el producto y la cantidad en este depósito. Podés cambiar solo el mínimo o el vencimiento sin mover stock."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Producto / Variante" error={errors.variant} required>
          <SearchableSelect
            value={variantId}
            onChange={v => {
              setVariantId(v)
              if (!v) {
                loadedQuantityRef.current = null
                setQuantity('')
                setMinimumQty('0')
                setExpiresOn(null)
                setBatchCode('')
                setBatchExpiry(null)
              }
            }}
            onSearch={searchVariants}
            placeholder="Buscar producto…"
          />
        </FormField>

        {variantId && loadingRow && (
          <p className="text-fg-muted text-xs">Cargando datos de stock…</p>
        )}

        <div className="flex flex-col gap-1.5">
          <FormField label="Cantidad actual" error={errors.quantity} required>
            <Input
              type="number"
              min={0}
              step="0.0001"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="0"
            />
          </FormField>
          <p className="text-[11px] text-fg-muted -mt-1">
            Si no la modificás, solo se actualizan mínimo y vencimiento (sin movimiento en el historial).
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-md border border-border bg-surface-muted/60 p-3">
          <div className="sm:col-span-2 text-[11px] font-medium text-fg-muted">
            Lote del ingreso (opcional — solo si aumentás la cantidad)
          </div>
          <FormField label="Código de lote">
            <Input
              value={batchCode}
              onChange={e => setBatchCode(e.target.value)}
              placeholder="Sin lote"
            />
          </FormField>
          <FormField label="Vencimiento del lote">
            <DatePicker value={batchExpiry} onChange={setBatchExpiry} placeholder="Sin vencimiento" />
          </FormField>
        </div>

        <FormField label="Stock mínimo (alerta)" error={errors.minimum}>
          <Input
            type="number"
            min={0}
            step="0.0001"
            value={minimumQty}
            onChange={e => setMinimumQty(e.target.value)}
            placeholder="0"
          />
        </FormField>

        <FormField label="Vencimiento (opcional)">
          <div className="flex flex-col gap-2">
            <DatePicker value={expiresOn} onChange={setExpiresOn} placeholder="Sin vencimiento" />
            <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setExpiresOn(null)}>
              Sin vencimiento
            </Button>
          </div>
        </FormField>

        <FormField label="Notas (solo si cambiás la cantidad)">
          <Input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Motivo del ajuste (opcional)"
          />
        </FormField>

        {serverError && <p className="text-danger text-sm">{serverError}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button type="submit" size="sm" disabled={submitting || loadingRow}>
            {submitting ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
