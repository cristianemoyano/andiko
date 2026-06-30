'use client'

import { useState } from 'react'
import { Dialog } from '@/components/primitives/Dialog'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { Button } from '@/components/primitives/Button'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

export type BulkStockItem = {
  variant_id: string
  warehouse_id: string
}

interface BulkStockMinimumModalProps {
  items: BulkStockItem[]
  onClose: () => void
  onSaved: () => void
}

export function BulkStockMinimumModal({ items, onClose, onSaved }: BulkStockMinimumModalProps) {
  const [minimumQty, setMinimumQty] = useState('0')
  const [errors, setErrors]         = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const minN = Number(minimumQty)
    if (!Number.isFinite(minN) || minN < 0) {
      setErrors({ minimum: 'Ingresá un número válido ≥ 0' })
      return
    }
    setErrors({})
    setSubmitting(true)
    setServerError(null)
    try {
      await fetchJson('/api/v1/inventory/stock/bulk-alerts', {
        method: 'POST',
        body: JSON.stringify({
          items,
          minimum_quantity: minN,
        }),
      })
      onSaved()
    } catch (err) {
      setServerError(getApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={open => { if (!open) onClose() }}
      title="Configurar stock mínimo"
      description={`Se aplicará a ${items.length} producto(s) seleccionado(s).`}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 pb-5">
        <FormField label="Stock mínimo (alerta)" error={errors.minimum} required>
          <Input
            type="number"
            min={0}
            step="0.0001"
            value={minimumQty}
            onChange={e => setMinimumQty(e.target.value)}
            placeholder="0"
            autoFocus
          />
        </FormField>

        {serverError && <p className="text-danger text-sm">{serverError}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={submitting}>
            {submitting ? 'Guardando…' : 'Aplicar'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
