'use client'

import { useState } from 'react'
import { Dialog } from '@/components/primitives/Dialog'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { Button } from '@/components/primitives/Button'
import { SearchableSelect } from '@/components/erp/SearchableSelect'
import type { SearchableSelectOption } from '@/components/erp/SearchableSelect'

interface AjusteStockModalProps {
  warehouseId: string
  onClose: () => void
  onSaved: () => void
}

export function AjusteStockModal({ warehouseId, onClose, onSaved }: AjusteStockModalProps) {
  const [variantId, setVariantId]   = useState<string | null>(null)
  const [quantity, setQuantity]     = useState('')
  const [notes, setNotes]           = useState('')
  const [errors, setErrors]         = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function searchVariants(q: string): Promise<SearchableSelectOption[]> {
    const res = await fetch(`/api/v1/catalog/products/for-sale?search=${encodeURIComponent(q)}&manage_stock=true&limit=20`)
    const data = await res.json()
    return (data.data ?? []).map((p: { variant_id: string; name: string; sku: string }) => ({
      value: p.variant_id,
      label: p.name,
      sublabel: p.sku,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!variantId) errs.variant = 'Seleccioná una variante'
    if (!quantity || isNaN(Number(quantity)) || Number(quantity) < 0) errs.quantity = 'Cantidad válida requerida'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSubmitting(true)
    setServerError(null)
    try {
      const res = await fetch('/api/v1/inventory/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variant_id:   variantId,
          warehouse_id: warehouseId,
          quantity:     Number(quantity),
          notes:        notes.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setServerError(data.error ?? 'Error al registrar ajuste')
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
      title="Ajuste de stock"
      description="Establecé la cantidad actual para una variante en este depósito."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Producto / Variante" error={errors.variant} required>
          <SearchableSelect
            value={variantId}
            onChange={setVariantId}
            onSearch={searchVariants}
            placeholder="Buscar producto…"
          />
        </FormField>

        <FormField label="Cantidad nueva" error={errors.quantity} required>
          <Input
            type="number"
            min={0}
            step="0.0001"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            placeholder="0"
          />
        </FormField>

        <FormField label="Notas">
          <Input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Motivo del ajuste (opcional)"
          />
        </FormField>

        {serverError && <p className="text-red-600 text-sm">{serverError}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button type="submit" size="sm" disabled={submitting}>
            {submitting ? 'Guardando…' : 'Registrar ajuste'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
