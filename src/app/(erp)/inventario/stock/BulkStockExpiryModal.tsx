'use client'

import { useState } from 'react'
import { Dialog } from '@/components/primitives/Dialog'
import { FormField } from '@/components/primitives/FormField'
import { Button } from '@/components/primitives/Button'
import { DatePicker } from '@/components/primitives/DatePicker'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import type { BulkStockItem } from './BulkStockMinimumModal'

function toIsoDateUtc(d: Date | null): string | null {
  if (!d) return null
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

interface BulkStockExpiryModalProps {
  items: BulkStockItem[]
  onClose: () => void
  onSaved: () => void
}

export function BulkStockExpiryModal({ items, onClose, onSaved }: BulkStockExpiryModalProps) {
  const [expiresOn, setExpiresOn]       = useState<Date | null>(null)
  const [serverError, setServerError]   = useState<string | null>(null)
  const [submitting, setSubmitting]     = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setServerError(null)
    try {
      await fetchJson('/api/v1/inventory/stock/bulk-expiry', {
        method: 'POST',
        body: JSON.stringify({
          items,
          expires_on: toIsoDateUtc(expiresOn),
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
      title="Configurar vencimiento"
      description={`Se aplicará a ${items.length} producto(s) seleccionado(s).`}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 pb-5">
        <FormField label="Vencimiento (opcional)">
          <div className="flex flex-col gap-2">
            <DatePicker value={expiresOn} onChange={setExpiresOn} placeholder="Sin vencimiento" />
            <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setExpiresOn(null)}>
              Sin vencimiento
            </Button>
          </div>
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
