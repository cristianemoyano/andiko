'use client'

import { useState } from 'react'
import { Dialog } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { Select } from '@/components/primitives/Select'
import { Input } from '@/components/primitives/Input'
import { FormField } from '@/components/primitives/FormField'
import { CurrencyInput, formatARS } from '@/components/primitives/CurrencyInput'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { fieldErrorsFromApiError } from '@/lib/validation-errors'
import { BILLING_PAYMENT_METHODS } from '@/types'

interface InvoiceRef {
  id: string
  invoice_number: string
  balance: string
}

interface RecordPaymentModalProps {
  open: boolean
  invoice: InvoiceRef | null
  onClose: () => void
  onSaved: () => void
}

type FieldErrors = Record<string, string[]>

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo', transfer: 'Transferencia', check: 'Cheque', card: 'Tarjeta', other: 'Otro',
}

function RecordPaymentForm({ invoice, onClose, onSaved }: { invoice: InvoiceRef } & Pick<RecordPaymentModalProps, 'onClose' | 'onSaved'>) {
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [amount, setAmount] = useState(() => invoice.balance)
  const [method, setMethod] = useState('transfer')
  const [reference, setReference] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true); setErrors({}); setServerError(null)
    try {
      await fetchJson('/api/v1/sys-admin/billing/payments', {
        method: 'POST',
        body: JSON.stringify({
          invoice_id: invoice.id,
          amount: amount || '0.00',
          payment_method: method,
          reference: reference.trim() || null,
        }),
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
        <p className="text-[12px] text-fg-muted">
          Factura <span className="font-mono">{invoice.invoice_number}</span> · Saldo {formatARS(invoice.balance)}
        </p>
        <FormField label="Monto (ARS)" htmlFor="pay_amount" error={errors.amount?.[0]}>
          <CurrencyInput id="pay_amount" value={amount} onChange={setAmount} error={!!errors.amount} />
        </FormField>
        <FormField label="Medio de pago" htmlFor="pay_method" error={errors.payment_method?.[0]}>
          <Select id="pay_method" value={method} onChange={setMethod}
            options={BILLING_PAYMENT_METHODS.map(m => ({ value: m, label: METHOD_LABELS[m] }))} />
        </FormField>
        <FormField label="Referencia (opcional)" htmlFor="pay_ref" error={errors.reference?.[0]}>
          <Input id="pay_ref" value={reference} onChange={e => setReference(e.target.value)} placeholder="N° de operación" />
        </FormField>
        {serverError && (
          <p role="alert" className="text-[12px] text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">{serverError}</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" size="sm" disabled={saving}>{saving ? 'Registrando…' : 'Registrar'}</Button>
        </div>
      </div>
    </form>
  )
}

export function RecordPaymentModal({ open, invoice, onClose, onSaved }: RecordPaymentModalProps) {
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }} title="Registrar pago" size="md">
      {open && invoice ? (
        <RecordPaymentForm key={invoice.id} invoice={invoice} onClose={onClose} onSaved={onSaved} />
      ) : null}
    </Dialog>
  )
}
