'use client'

import { useState } from 'react'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { FormField } from '@/components/primitives/FormField'
import { cn } from '@/lib/utils'
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
}

export function PaymentInfoSection({ contactId, initialPaymentInfo }: PaymentInfoSectionProps) {
  const [items, setItems] = useState<PaymentInfo[]>(initialPaymentInfo)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PaymentInfo | null>(null)

  async function refresh() {
    const res = await fetch(`/api/v1/contacts/${contactId}/payment-info`)
    if (res.ok) setItems(await res.json() as PaymentInfo[])
  }

  function openCreate() { setEditing(null); setModalOpen(true) }
  function openEdit(item: PaymentInfo) { setEditing(item); setModalOpen(true) }

  return (
    <div className="bg-white border border-zinc-200 rounded overflow-hidden">
      <div className="px-4 py-2.5 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Datos de pago</span>
        <Button variant="ghost" size="xs" onClick={openCreate}>+ Agregar</Button>
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-6 text-center text-[13px] text-zinc-400">
          Sin datos de pago registrados.
        </div>
      ) : (
        <div className="divide-y divide-zinc-100">
          {items.map(item => (
            <div key={item.id} className="px-4 py-3 flex items-start justify-between gap-4 group">
              <div className="min-w-0">
                {item.bank_name && (
                  <p className="text-[13px] font-medium text-zinc-900">{item.bank_name}</p>
                )}
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {item.cbu && (
                    <span className="font-mono text-[12px] text-zinc-700">CBU {formatCbu(item.cbu)}</span>
                  )}
                  {item.alias && (
                    <span className="text-[12px] text-zinc-500">Alias: {item.alias}</span>
                  )}
                  {item.account_type && (
                    <span className="text-[11px] text-zinc-400">{ACCOUNT_TYPE_LABEL[item.account_type]}</span>
                  )}
                  {item.is_default && (
                    <span className="text-[11px] text-zinc-400">Principal</span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="xs"
                className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                onClick={() => openEdit(item)}
              >
                Editar
              </Button>
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
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setSaving(false)

    if (res.ok) { onSaved(); return }
    const data = await res.json() as { code: string; details?: { fieldErrors?: FieldErrors } }
    if (data.code === 'VALIDATION_ERROR' && data.details?.fieldErrors) setErrors(data.details.fieldErrors)
    if (data.code === 'DUPLICATE_CBU') setErrors({ cbu: ['El CBU ya está registrado en otro contacto'] })
  }

  async function handleDelete() {
    if (!item) return
    if (!confirm('¿Eliminar este dato de pago?')) return
    await fetch(`/api/v1/contacts/${contactId}/payment-info/${item.id}`, { method: 'DELETE' })
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded shadow-xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
          <h2 className="text-[15px] font-semibold text-zinc-900 tracking-tight">
            {isEdit ? 'Editar dato de pago' : 'Nuevo dato de pago'}
          </h2>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-700">
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

            <FormField label="CBU" htmlFor="cbu" error={errors.cbu?.[0]}>
              <Input id="cbu" name="cbu" defaultValue={item?.cbu ?? ''} placeholder="22 dígitos" maxLength={22} disabled={saving} error={!!errors.cbu} />
            </FormField>

            <FormField label="Alias" htmlFor="alias" error={errors.alias?.[0]}>
              <Input id="alias" name="alias" defaultValue={item?.alias ?? ''} placeholder="nombre.apellido.banco" disabled={saving} error={!!errors.alias} />
            </FormField>

            <FormField label="Tipo de cuenta" htmlFor="account_type" error={errors.account_type?.[0]}>
              <select
                id="account_type" name="account_type"
                defaultValue={item?.account_type ?? ''}
                className={cn('h-8 w-full rounded-sm border px-2.5 text-[13px] text-zinc-900 bg-white focus:outline-none focus:border-blue-500', errors.account_type ? 'border-red-500' : 'border-zinc-300')}
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
              <span className="text-[13px] text-zinc-700">Dato de pago principal</span>
            </label>
          </div>

          <div className="flex items-center justify-between px-5 py-4 border-t border-zinc-200 bg-zinc-50">
            <div>
              {isEdit && (
                <Button type="button" variant="danger" size="sm" onClick={handleDelete} disabled={saving}>Eliminar</Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Agregar'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
