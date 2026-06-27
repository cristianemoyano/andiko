'use client'

import { useState } from 'react'
import { Dialog } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { FormField } from '@/components/primitives/FormField'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { fieldErrorsFromApiError } from '@/lib/validation-errors'

interface GenerateInvoiceModalProps {
  open: boolean
  subscriptionId: string
  onClose: () => void
  onSaved: () => void
}

type FieldErrors = Record<string, string[]>

function firstOfMonth(d: Date): string { return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10) }
function lastOfMonth(d: Date): string { return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10) }

function GenerateInvoiceForm({ subscriptionId, onClose, onSaved }: Omit<GenerateInvoiceModalProps, 'open'>) {
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [periodStart, setPeriodStart] = useState(() => firstOfMonth(new Date()))
  const [periodEnd, setPeriodEnd] = useState(() => lastOfMonth(new Date()))

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true); setErrors({}); setServerError(null)
    try {
      await fetchJson('/api/v1/sys-admin/billing/invoices', {
        method: 'POST',
        body: JSON.stringify({ subscription_id: subscriptionId, period_start: periodStart, period_end: periodEnd }),
      })
      onSaved()
      onClose()
    } catch (err) {
      const fe = fieldErrorsFromApiError(err)
      if (fe) setErrors(fe)
      else setServerError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="flex flex-col gap-4">
        <FormField label="Inicio del período" htmlFor="period_start" error={errors.period_start?.[0]}>
          <Input id="period_start" type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} error={!!errors.period_start} required />
        </FormField>
        <FormField label="Fin del período" htmlFor="period_end" error={errors.period_end?.[0]}>
          <Input id="period_end" type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} error={!!errors.period_end} required />
        </FormField>
        <p className="text-[12px] text-fg-muted">
          La factura se crea en borrador con el cargo base, usuarios adicionales, add-ons habilitados y el uso medido del período.
        </p>
        {serverError && (
          <p role="alert" className="text-[12px] text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">{serverError}</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" size="sm" disabled={saving}>{saving ? 'Generando…' : 'Generar'}</Button>
        </div>
      </div>
    </form>
  )
}

export function GenerateInvoiceModal({ open, subscriptionId, onClose, onSaved }: GenerateInvoiceModalProps) {
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }} title="Generar factura" size="md">
      {open ? (
        <GenerateInvoiceForm subscriptionId={subscriptionId} onClose={onClose} onSaved={onSaved} />
      ) : null}
    </Dialog>
  )
}
