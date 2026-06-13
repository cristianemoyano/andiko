'use client'

import { useState } from 'react'
import { Dialog } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { FormField } from '@/components/primitives/FormField'
import { cn } from '@/lib/utils'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { fieldErrorsFromApiError } from '@/lib/validation-errors'
import { ACCOUNT_TYPE_LABEL, type Account } from '../types'

interface CuentaModalProps {
  open: boolean
  account: Account | null
  accounts: Account[]
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

type FieldErrors = Record<string, string[]>

export function CuentaModal({ open, account, accounts, onOpenChange, onSaved }: CuentaModalProps) {
  const isEdit = account !== null
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    setServerError(null)

    const form = new FormData(e.currentTarget)
    const body = {
      code:        String(form.get('code') ?? '').trim(),
      name:        String(form.get('name') ?? '').trim(),
      type:        form.get('type'),
      parent_id:   form.get('parent_id') ? String(form.get('parent_id')) : null,
      is_postable: form.get('is_postable') === 'on',
      is_active:   form.get('is_active') === 'on',
    }

    const url    = isEdit ? `/api/v1/accounting/accounts/${account.id}` : '/api/v1/accounting/accounts'
    const method = isEdit ? 'PATCH' : 'POST'

    try {
      await fetchJson(url, { method, body: JSON.stringify(body) })
      onSaved()
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

  const parentOptions = accounts.filter(a => a.id !== account?.id)

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Editar cuenta' : 'Nueva cuenta'}
      size="md"
    >
      <form key={`${account?.id ?? 'new'}-${String(open)}`} onSubmit={handleSubmit} noValidate>
        <div className="px-5 py-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Código" htmlFor="code" required error={errors.code?.[0]}>
              <Input
                id="code"
                name="code"
                defaultValue={account?.code ?? ''}
                placeholder="Ej: 1.1.01.03"
                required
                error={!!errors.code}
                disabled={saving}
              />
            </FormField>
            <FormField label="Tipo" htmlFor="type" required error={errors.type?.[0]}>
              <select
                id="type"
                name="type"
                defaultValue={account?.type ?? 'asset'}
                className={cn(
                  'h-8 w-full rounded-sm border px-2.5 text-[13px] text-zinc-900 bg-white focus:outline-none focus:border-blue-500',
                  errors.type ? 'border-red-500' : 'border-zinc-300'
                )}
              >
                {Object.entries(ACCOUNT_TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label="Nombre" htmlFor="name" required error={errors.name?.[0]}>
            <Input
              id="name"
              name="name"
              defaultValue={account?.name ?? ''}
              placeholder="Ej: Banco Galicia Cta. Cte."
              required
              error={!!errors.name}
              disabled={saving}
            />
          </FormField>

          <FormField label="Cuenta padre" htmlFor="parent_id" error={errors.parent_id?.[0]}>
            <select
              id="parent_id"
              name="parent_id"
              defaultValue={account?.parent_id ?? ''}
              className="h-8 w-full rounded-sm border border-zinc-300 px-2.5 text-[13px] text-zinc-900 bg-white focus:outline-none focus:border-blue-500"
            >
              <option value="">— Sin cuenta padre —</option>
              {parentOptions.map(a => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          </FormField>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                name="is_postable"
                defaultChecked={account ? account.is_postable : true}
                className="w-4 h-4 rounded-sm accent-brand-600 cursor-pointer"
              />
              <span className="text-[13px] text-zinc-700">Imputable (recibe asientos)</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={account ? account.is_active : true}
                className="w-4 h-4 rounded-sm accent-brand-600 cursor-pointer"
              />
              <span className="text-[13px] text-zinc-700">Activa</span>
            </label>
          </div>

          {serverError && (
            <p role="alert" className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2">
              {serverError}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-200 bg-zinc-50">
          <Button type="button" variant="secondary" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear cuenta'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
