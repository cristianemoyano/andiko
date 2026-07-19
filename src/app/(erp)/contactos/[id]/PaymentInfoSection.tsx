'use client'

import { useState } from 'react'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { FormField } from '@/components/primitives/FormField'
import { cn } from '@/lib/utils'
import { fetchJson, isApiRequestError } from '@/lib/fetch-json'
import { notifyApiError, notifySuccess } from '@/lib/notify'
import { fieldErrorsFromApiError } from '@/lib/validation-errors'
import type { AccountType } from '@/modules/contacts/contact-payment-info.model'

export type PaymentInfo = {
  id: string
  bank_name: string | null
  cbu: string | null
  alias: string | null
  account_type: AccountType | null
  is_default: boolean
}

const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  checking: 'Cuenta corriente',
  savings:  'Caja de ahorro',
}

function formatCbu(cbu: string) {
  return `${cbu.slice(0, 8)} ${cbu.slice(8, 14)} ${cbu.slice(14, 22)}`
}

interface PaymentInfoSectionProps {
  contactId: string
  initialPaymentInfo: PaymentInfo[]
  readOnly?: boolean
}

export function PaymentInfoSection({ contactId, initialPaymentInfo, readOnly = false }: PaymentInfoSectionProps) {
  const [items, setItems] = useState<PaymentInfo[]>(initialPaymentInfo)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PaymentInfo | null>(null)

  async function refresh() {
    try {
      const list = await fetchJson<PaymentInfo[]>(`/api/v1/contacts/${contactId}/payment-info`)
      setItems(Array.isArray(list) ? list : [])
    } catch (e) {
      notifyApiError(e)
    }
  }

  function openCreate() { setEditing(null); setModalOpen(true) }
  function openEdit(item: PaymentInfo) { setEditing(item); setModalOpen(true) }

  return (
    <div className="bg-surface border border-border rounded overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border bg-surface-muted flex items-center justify-between">
        <span className="text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Datos de pago</span>
        {!readOnly && (
          <Button variant="ghost" size="xs" onClick={openCreate} data-testid="payment-info-add-btn">+ Agregar</Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-6 text-center text-[13px] text-fg-subtle">
          Sin datos de pago registrados.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {items.map(item => (
            <div key={item.id} className="px-4 py-3 flex items-start justify-between gap-4 group">
              <div className="min-w-0">
                {item.bank_name && (
                  <p className="text-[13px] font-medium text-fg">{item.bank_name}</p>
                )}
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {item.cbu && (
                    <span className="font-mono text-[12px] text-fg-muted">CBU {formatCbu(item.cbu)}</span>
                  )}
                  {item.alias && (
                    <span className="text-[12px] text-fg-muted">Alias: {item.alias}</span>
                  )}
                  {item.account_type && (
                    <span className="text-[11px] text-fg-subtle">{ACCOUNT_TYPE_LABEL[item.account_type]}</span>
                  )}
                  {item.is_default && (
                    <span className="text-[11px] text-fg-subtle">Principal</span>
                  )}
                </div>
              </div>
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="xs"
                  className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  onClick={() => openEdit(item)}
                >
                  Editar
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <PaymentInfoModal
          contactId={contactId}
          item={editing}
          onClose={() => setModalOpen(false)}
          onSaved={async () => { setModalOpen(false); await refresh() }}
        />
      )}
    </div>
  )
}

type FieldErrors = Record<string, string[]>

function PaymentInfoModal({ contactId, item, onClose, onSaved }: {
  contactId: string
  item: PaymentInfo | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = item !== null
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setErrors({})

    const form = new FormData(e.currentTarget)
    const body = {
      bank_name:    form.get('bank_name') || null,
      cbu:          form.get('cbu') || null,
      alias:        form.get('alias') || null,
      account_type: form.get('account_type') || null,
      is_default:   form.get('is_default') === 'on',
    }

    const url    = isEdit ? `/api/v1/contacts/${contactId}/payment-info/${item.id}` : `/api/v1/contacts/${contactId}/payment-info`
    const method = isEdit ? 'PATCH' : 'POST'
    try {
      await fetchJson(url, { method, body: JSON.stringify(body) })
      notifySuccess(isEdit ? 'Dato de pago actualizado' : 'Dato de pago agregado')
      onSaved()
    } catch (err) {
      const fe = fieldErrorsFromApiError(err)
      if (fe) {
        setErrors(fe)
        return
      }
      if (isApiRequestError(err) && err.code === 'DUPLICATE_CBU') {
        setErrors({ cbu: ['El CBU ya está registrado en otro contacto'] })
        return
      }
      notifyApiError(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!item) return
    if (!confirm('¿Eliminar este dato de pago?')) return
    try {
      await fetchJson(`/api/v1/contacts/${contactId}/payment-info/${item.id}`, { method: 'DELETE' })
      notifySuccess('Dato de pago eliminado')
      onSaved()
    } catch (e) {
      notifyApiError(e)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-surface rounded shadow-xl w-full max-w-md flex flex-col" data-testid="payment-info-modal">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-[15px] font-semibold text-fg tracking-tight">
            {isEdit ? 'Editar dato de pago' : 'Nuevo dato de pago'}
          </h2>
          <button type="button" onClick={onClose} className="text-fg-subtle hover:text-fg-muted">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13"/>
            </svg>
          </button>
        </div>

        <form key={item?.id ?? 'new'} onSubmit={handleSubmit} noValidate>
          <div className="px-5 py-4 flex flex-col gap-4">
            <FormField label="Banco" htmlFor="bank_name" error={errors.bank_name?.[0]}>
              <Input id="bank_name" name="bank_name" defaultValue={item?.bank_name ?? ''} placeholder="Banco Nación" disabled={saving} error={!!errors.bank_name} />
            </FormField>

            <FormField label="CBU" htmlFor="cbu" error={errors.cbu?.[0]} errorTestId="cbu-error">
              <Input id="cbu" name="cbu" defaultValue={item?.cbu ?? ''} placeholder="22 dígitos" maxLength={22} disabled={saving} error={!!errors.cbu} />
            </FormField>

            <FormField label="Alias" htmlFor="alias" error={errors.alias?.[0]}>
              <Input id="alias" name="alias" defaultValue={item?.alias ?? ''} placeholder="nombre.apellido.banco" disabled={saving} error={!!errors.alias} />
            </FormField>

            <FormField label="Tipo de cuenta" htmlFor="account_type" error={errors.account_type?.[0]}>
              <select
                id="account_type" name="account_type"
                defaultValue={item?.account_type ?? ''}
                className={cn('h-8 w-full rounded-sm border px-2.5 text-[13px] text-fg bg-surface focus:outline-none focus:border-ring', errors.account_type ? 'border-danger' : 'border-border-strong')}
                disabled={saving}
              >
                <option value="">Sin especificar</option>
                <option value="checking">Cuenta corriente</option>
                <option value="savings">Caja de ahorro</option>
              </select>
            </FormField>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                name="is_default"
                defaultChecked={item?.is_default ?? false}
                className="w-4 h-4 rounded-sm cursor-pointer"
              />
              <span className="text-[13px] text-fg-muted">Dato de pago principal</span>
            </label>
          </div>

          <div className="flex items-center justify-between px-5 py-4 border-t border-border bg-surface-muted">
            <div>
              {isEdit && (
                <Button type="button" variant="danger" size="sm" onClick={handleDelete} disabled={saving}>Eliminar</Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
              <Button type="submit" size="sm" disabled={saving} data-testid="payment-info-save-btn">
                {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Agregar'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
