'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogFooter } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Switch } from '@/components/primitives/Switch'
import { CurrencyInput } from '@/components/primitives/CurrencyInput'
import { DatePicker } from '@/components/primitives/DatePicker'
import { SearchableSelect, type SearchableSelectOption } from '@/components/erp/SearchableSelect'
import { BranchSelectField } from '@/components/erp/BranchSelectField'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifySuccess } from '@/lib/notify'
import { fieldErrorsFromApiError } from '@/lib/validation-errors'
import { IVA_RATES, type IvaRate } from '@/types'
import type { RecurringExpenseTemplate, RecurringExpenseFrequency } from '../types'
import { RECURRING_FREQUENCY_LABEL } from '../types'

type ExpenseAccountOption = { code: string; name: string }

export interface RecurringExpenseTemplateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: RecurringExpenseTemplate | null
  onSaved: () => void
}

const FREQUENCY_OPTIONS = (Object.keys(RECURRING_FREQUENCY_LABEL) as RecurringExpenseFrequency[]).map(
  f => ({ value: f, label: RECURRING_FREQUENCY_LABEL[f] })
)

export function RecurringExpenseTemplateModal({ open, onOpenChange, template, onSaved }: RecurringExpenseTemplateModalProps) {
  const isEdit = !!template

  const [branchId, setBranchId] = useState<string | null>(null)
  const [contactId, setContactId] = useState<string | null>(null)
  const [contactOpts, setContactOpts] = useState<SearchableSelectOption[]>([])
  const [description, setDescription] = useState('')
  const [accountCode, setAccountCode] = useState('')
  const [accountOpts, setAccountOpts] = useState<ExpenseAccountOption[]>([])
  const [defaultAmount, setDefaultAmount] = useState('')
  const [ivaRate, setIvaRate] = useState<IvaRate>('21')
  const [frequency, setFrequency] = useState<RecurringExpenseFrequency>('monthly')
  const [nextRunDate, setNextRunDate] = useState<Date | null>(new Date())
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setBranchId(template?.branch_id ?? null)
      setContactId(template?.contact_id ?? null)
      setContactOpts(
        template?.contact
          ? [{ value: template.contact_id, label: template.contact.legal_name, sublabel: template.contact.trade_name ?? undefined }]
          : [],
      )
      setDescription(template?.description ?? '')
      setAccountCode(template?.expense_account_code ?? '')
      setDefaultAmount(template?.default_amount ?? '')
      setIvaRate((template?.iva_rate as IvaRate) ?? '21')
      setFrequency(template?.frequency ?? 'monthly')
      setNextRunDate(template?.next_run_date ? new Date(template.next_run_date) : new Date())
      setIsActive(template?.is_active ?? true)
      setErrors({})
      setServerError(null)
    })
  }, [open, template])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const d = await fetchJson<{ data: ExpenseAccountOption[] }>(
          '/api/v1/accounting/accounts?type=expense&all=true&is_postable=true',
        )
        if (!cancelled) setAccountOpts(d.data ?? [])
      } catch {
        /* ignore */
      }
    })()
    return () => { cancelled = true }
  }, [])

  const searchSuppliers = useCallback(async (q: string): Promise<SearchableSelectOption[]> => {
    try {
      const data = await fetchJson<{ data: Array<{ id: string; legal_name: string; trade_name: string | null }> }>(
        `/api/v1/contacts?search=${encodeURIComponent(q)}&limit=20&type=supplier`,
      )
      return (data.data ?? []).map(c => ({ value: c.id, label: c.legal_name, sublabel: c.trade_name ?? undefined }))
    } catch {
      return []
    }
  }, [])

  async function handleSave() {
    setSaving(true)
    setErrors({})
    setServerError(null)

    const body = {
      branch_id:            branchId,
      contact_id:            contactId,
      description:           description.trim(),
      expense_account_code:  accountCode,
      default_amount:        parseFloat(defaultAmount) || 0,
      iva_rate:              ivaRate,
      frequency,
      next_run_date:         (nextRunDate ?? new Date()).toISOString(),
      is_active:             isActive,
    }

    try {
      if (isEdit) {
        await fetchJson(`/api/v1/expenses/recurring-templates/${template!.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
        notifySuccess('Plantilla actualizada')
      } else {
        await fetchJson('/api/v1/expenses/recurring-templates', {
          method: 'POST',
          body: JSON.stringify(body),
        })
        notifySuccess('Plantilla creada')
      }
      onOpenChange(false)
      onSaved()
    } catch (e) {
      const fe = fieldErrorsFromApiError(e)
      if (fe) setErrors(fe)
      else setServerError(getApiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Editar gasto recurrente' : 'Nuevo gasto recurrente'}
      size="lg"
      footer={
        <DialogFooter error={serverError}>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Sucursal" required error={errors.branch_id?.[0]}>
          <BranchSelectField value={branchId} onChange={setBranchId} />
        </FormField>

        <FormField label="Proveedor" required error={errors.contact_id?.[0]}>
          <SearchableSelect
            value={contactId}
            onChange={setContactId}
            onSearch={searchSuppliers}
            options={contactOpts.length > 0 ? contactOpts : undefined}
            placeholder="Buscar proveedor…"
          />
        </FormField>

        <FormField label="Descripción" required error={errors.description?.[0]} className="md:col-span-2">
          <Input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Ej: Alquiler local, EDEMSA - luz"
          />
        </FormField>

        <FormField label="Cuenta de gasto" required error={errors.expense_account_code?.[0]}>
          <Select
            value={accountCode}
            onChange={setAccountCode}
            options={accountOpts.map(a => ({ value: a.code, label: `${a.code} · ${a.name}` }))}
            placeholder="Elegí una cuenta…"
          />
        </FormField>

        <FormField label="Monto" required error={errors.default_amount?.[0]}>
          <CurrencyInput value={defaultAmount} onChange={setDefaultAmount} placeholder="0,00" />
        </FormField>

        <FormField label="IVA">
          <Select
            value={ivaRate}
            onChange={v => setIvaRate(v as IvaRate)}
            options={IVA_RATES.map(r => ({ value: r, label: `${r}%` }))}
          />
        </FormField>

        <FormField label="Frecuencia">
          <Select
            value={frequency}
            onChange={v => setFrequency(v as RecurringExpenseFrequency)}
            options={FREQUENCY_OPTIONS}
          />
        </FormField>

        <FormField label="Próxima generación" required error={errors.next_run_date?.[0]}>
          <DatePicker value={nextRunDate} onChange={setNextRunDate} />
        </FormField>

        <FormField label="Activa">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </FormField>
      </div>
    </Dialog>
  )
}
