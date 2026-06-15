'use client'

import { useEffect, useState } from 'react'
import { Dialog } from '@/components/primitives/Dialog'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { Button } from '@/components/primitives/Button'
import type { SearchableSelectOption } from '@/components/erp/SearchableSelect'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { fieldErrorsFromApiError } from '@/lib/validation-errors'

type FieldErrors = Record<string, string[]>

type IvaCondition =
  | 'responsable_inscripto'
  | 'monotributista'
  | 'consumidor_final'
  | 'exento'
  | 'no_responsable'

const IVA_OPTIONS: Array<{ value: IvaCondition; label: string }> = [
  { value: 'responsable_inscripto', label: 'Responsable inscripto' },
  { value: 'monotributista', label: 'Monotributista' },
  { value: 'consumidor_final', label: 'Consumidor final' },
  { value: 'exento', label: 'Exento' },
  { value: 'no_responsable', label: 'No responsable' },
]

interface CustomerQuickCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialLegalName: string
  onCreated: (option: SearchableSelectOption) => void
}

export function CustomerQuickCreateDialog({
  open,
  onOpenChange,
  initialLegalName,
  onCreated,
}: CustomerQuickCreateDialogProps) {
  const [legalName, setLegalName] = useState('')
  const [cuit, setCuit] = useState('')
  const [ivaCondition, setIvaCondition] = useState<IvaCondition>('responsable_inscripto')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setLegalName(initialLegalName)
      setCuit('')
      setIvaCondition('responsable_inscripto')
      setErrors({})
      setServerError(null)
    })
  }, [open, initialLegalName])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    setServerError(null)

    try {
      const contact = await fetchJson<{ id: string; legal_name: string; trade_name: string | null }>('/api/v1/contacts', {
        method: 'POST',
        body: JSON.stringify({
          type: 'customer',
          legal_name: legalName.trim(),
          cuit: cuit.trim(),
          iva_condition: ivaCondition,
        }),
      })
      onCreated({
        value: contact.id,
        label: contact.legal_name,
        sublabel: contact.trade_name ?? undefined,
      })
      onOpenChange(false)
    } catch (err) {
      const fe = fieldErrorsFromApiError(err)
      if (fe) {
        setErrors(fe)
        return
      }
      setServerError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Crear cliente"
      description="Creá un cliente sin salir del flujo actual."
      size="sm"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Razón social" htmlFor="quick_legal_name" required error={errors.legal_name?.[0]}>
          <Input
            id="quick_legal_name"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            placeholder="Empresa S.A."
            required
            error={!!errors.legal_name}
            disabled={saving}
          />
        </FormField>

        <FormField label="CUIT" htmlFor="quick_cuit" required error={errors.cuit?.[0]}>
          <Input
            id="quick_cuit"
            value={cuit}
            onChange={(e) => setCuit(e.target.value)}
            placeholder="30-12345678-9"
            required
            error={!!errors.cuit}
            disabled={saving}
          />
        </FormField>

        <FormField label="Condición IVA" htmlFor="quick_iva_condition" required error={errors.iva_condition?.[0]}>
          <select
            id="quick_iva_condition"
            value={ivaCondition}
            onChange={(e) => setIvaCondition(e.target.value as IvaCondition)}
            className="h-8 w-full rounded-sm border border-border-strong bg-surface px-2.5 text-[13px] text-fg focus:border-ring focus:outline-none"
            disabled={saving}
          >
            {IVA_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </FormField>

        {serverError ? (
          <p role="alert" className="rounded-sm border border-danger bg-danger-bg px-3 py-2 text-[12px] text-danger">
            {serverError}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? 'Creando…' : 'Crear cliente'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
