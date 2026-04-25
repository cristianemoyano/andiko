'use client'

import { useState } from 'react'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { FormField } from '@/components/primitives/FormField'
import { Badge } from '@/components/primitives/Badge'
import { cn } from '@/lib/utils'
import { fetchJson } from '@/lib/fetch-json'
import { notifyApiError, notifySuccess } from '@/lib/notify'
import { fieldErrorsFromApiError } from '@/lib/validation-errors'

type Address = {
  id: string
  type: 'fiscal' | 'delivery' | 'commercial'
  street: string
  number: string | null
  floor: string | null
  apartment: string | null
  city: string
  province: string
  postal_code: string | null
  country: string
  is_default: boolean
}

const TYPE_LABEL: Record<string, string> = {
  fiscal:     'Fiscal',
  delivery:   'Entrega',
  commercial: 'Comercial',
}

const TYPE_STATUS = {
  fiscal:     'info',
  delivery:   'success',
  commercial: 'neutral',
} as const

function formatAddress(a: Address) {
  const parts = [a.street]
  if (a.number) parts[0] += ` ${a.number}`
  if (a.floor || a.apartment) parts[0] += `, ${[a.floor && `Piso ${a.floor}`, a.apartment && `Dpto ${a.apartment}`].filter(Boolean).join(' ')}`
  parts.push(a.city)
  parts.push(a.province)
  if (a.postal_code) parts.push(`(${a.postal_code})`)
  if (a.country !== 'Argentina') parts.push(a.country)
  return parts.join(', ')
}

interface AddressesSectionProps {
  contactId: string
  initialAddresses: Address[]
}

export function AddressesSection({ contactId, initialAddresses }: AddressesSectionProps) {
  const [addresses, setAddresses] = useState<Address[]>(initialAddresses)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Address | null>(null)

  async function refresh() {
    try {
      const list = await fetchJson<Address[]>(`/api/v1/contacts/${contactId}/addresses`)
      setAddresses(Array.isArray(list) ? list : [])
    } catch (e) {
      notifyApiError(e)
    }
  }

  function openCreate() { setEditing(null); setModalOpen(true) }
  function openEdit(a: Address) { setEditing(a); setModalOpen(true) }

  return (
    <div className="bg-white border border-zinc-200 rounded overflow-hidden">
      <div className="px-4 py-2.5 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Direcciones</span>
        <Button variant="ghost" size="xs" onClick={openCreate}>+ Agregar</Button>
      </div>

      {addresses.length === 0 ? (
        <div className="px-4 py-6 text-center text-[13px] text-zinc-400">
          Sin direcciones registradas.
        </div>
      ) : (
        <div className="divide-y divide-zinc-100">
          {addresses.map(addr => (
            <div key={addr.id} className="px-4 py-3 flex items-start justify-between gap-4 group">
              <div className="flex items-start gap-3 min-w-0">
                <Badge status={TYPE_STATUS[addr.type]} className="mt-0.5 flex-shrink-0">
                  {TYPE_LABEL[addr.type]}
                </Badge>
                <div>
                  <p className="text-[13px] text-zinc-900">{formatAddress(addr)}</p>
                  {addr.is_default && (
                    <span className="text-[11px] text-zinc-400">Principal</span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="xs"
                className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                onClick={() => openEdit(addr)}
              >
                Editar
              </Button>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <AddressModal
          contactId={contactId}
          address={editing}
          onClose={() => setModalOpen(false)}
          onSaved={async () => { setModalOpen(false); await refresh() }}
        />
      )}
    </div>
  )
}

type FieldErrors = Record<string, string[]>

function AddressModal({ contactId, address, onClose, onSaved }: {
  contactId: string
  address: Address | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = address !== null
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setErrors({})

    const form = new FormData(e.currentTarget)
    const body = {
      type:        form.get('type'),
      street:      form.get('street'),
      number:      form.get('number') || null,
      floor:       form.get('floor') || null,
      apartment:   form.get('apartment') || null,
      city:        form.get('city'),
      province:    form.get('province'),
      postal_code: form.get('postal_code') || null,
      country:     form.get('country') || 'Argentina',
      is_default:  form.get('is_default') === 'on',
    }

    const url    = isEdit ? `/api/v1/contacts/${contactId}/addresses/${address.id}` : `/api/v1/contacts/${contactId}/addresses`
    const method = isEdit ? 'PATCH' : 'POST'
    try {
      await fetchJson(url, { method, body: JSON.stringify(body) })
      onSaved()
    } catch (err) {
      const fe = fieldErrorsFromApiError(err)
      if (fe) setErrors(fe)
      else notifyApiError(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!address) return
    if (!confirm('¿Eliminar esta dirección?')) return
    try {
      await fetchJson(`/api/v1/contacts/${contactId}/addresses/${address.id}`, { method: 'DELETE' })
      notifySuccess('Dirección eliminada')
      onSaved()
    } catch (e) {
      notifyApiError(e)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded shadow-xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
          <h2 className="text-[15px] font-semibold text-zinc-900 tracking-tight">
            {isEdit ? 'Editar dirección' : 'Nueva dirección'}
          </h2>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-700">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13"/>
            </svg>
          </button>
        </div>

        <form key={address?.id ?? 'new'} onSubmit={handleSubmit} noValidate>
          <div className="px-5 py-4 flex flex-col gap-4">
            <FormField label="Tipo" htmlFor="type" required error={errors.type?.[0]}>
              <select
                id="type" name="type"
                defaultValue={address?.type ?? 'fiscal'}
                className={cn('h-8 w-full rounded-sm border px-2.5 text-[13px] text-zinc-900 bg-white focus:outline-none focus:border-blue-500', errors.type ? 'border-red-500' : 'border-zinc-300')}
              >
                <option value="fiscal">Fiscal</option>
                <option value="delivery">Entrega</option>
                <option value="commercial">Comercial</option>
              </select>
            </FormField>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <FormField label="Calle" htmlFor="street" required error={errors.street?.[0]}>
                  <Input id="street" name="street" defaultValue={address?.street ?? ''} placeholder="Av. San Martín" required error={!!errors.street} disabled={saving} />
                </FormField>
              </div>
              <FormField label="Número" htmlFor="number" error={errors.number?.[0]}>
                <Input id="number" name="number" defaultValue={address?.number ?? ''} placeholder="1234" error={!!errors.number} disabled={saving} />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Piso" htmlFor="floor" error={errors.floor?.[0]}>
                <Input id="floor" name="floor" defaultValue={address?.floor ?? ''} placeholder="3" disabled={saving} />
              </FormField>
              <FormField label="Depto" htmlFor="apartment" error={errors.apartment?.[0]}>
                <Input id="apartment" name="apartment" defaultValue={address?.apartment ?? ''} placeholder="B" disabled={saving} />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Ciudad" htmlFor="city" required error={errors.city?.[0]}>
                <Input id="city" name="city" defaultValue={address?.city ?? ''} placeholder="Mendoza" required error={!!errors.city} disabled={saving} />
              </FormField>
              <FormField label="Provincia" htmlFor="province" required error={errors.province?.[0]}>
                <Input id="province" name="province" defaultValue={address?.province ?? ''} placeholder="Mendoza" required error={!!errors.province} disabled={saving} />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Código postal" htmlFor="postal_code" error={errors.postal_code?.[0]}>
                <Input id="postal_code" name="postal_code" defaultValue={address?.postal_code ?? ''} placeholder="5500" disabled={saving} />
              </FormField>
              <FormField label="País" htmlFor="country" error={errors.country?.[0]}>
                <Input id="country" name="country" defaultValue={address?.country ?? 'Argentina'} disabled={saving} />
              </FormField>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input type="checkbox" name="is_default" defaultChecked={address?.is_default ?? false} className="w-4 h-4 rounded-sm cursor-pointer" />
              <span className="text-[13px] text-zinc-700">Dirección principal</span>
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
