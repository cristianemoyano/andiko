'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { FormField } from '@/components/primitives/FormField'
import { cn } from '@/lib/utils'

type Contact = {
  id: string
  type: 'customer' | 'supplier' | 'both'
  legal_name: string
  trade_name: string | null
  cuit: string | null
  iva_condition: string
  email: string | null
  phone: string | null
  is_active: boolean
}

interface ContactModalProps {
  open: boolean
  contact: Contact | null
  onClose: () => void
  onSaved: () => void
}

type FieldErrors = Record<string, string[]>

export function ContactModal({ open, contact, onClose, onSaved }: ContactModalProps) {
  const isEdit = contact !== null
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) dialog.showModal()
    else dialog.close()
  }, [open])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    setServerError(null)

    const form = new FormData(e.currentTarget)
    const body = {
      type:          form.get('type'),
      legal_name:    form.get('legal_name'),
      trade_name:    form.get('trade_name') || null,
      cuit:          form.get('cuit') || null,
      iva_condition: form.get('iva_condition'),
      email:         form.get('email') || null,
      phone:         form.get('phone') || null,
    }

    const url    = isEdit ? `/api/v1/contacts/${contact.id}` : '/api/v1/contacts'
    const method = isEdit ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    setSaving(false)

    if (res.ok) {
      onSaved()
      return
    }

    const data = await res.json() as { code: string; details?: { fieldErrors?: FieldErrors }; error?: string }

    if (data.code === 'VALIDATION_ERROR' && data.details?.fieldErrors) {
      setErrors(data.details.fieldErrors)
    } else if (data.code === 'DUPLICATE_CUIT') {
      setErrors({ cuit: ['El CUIT ya está registrado.'] })
    } else {
      setServerError(data.error ?? 'Ocurrió un error. Intentá de nuevo.')
    }
  }

  async function handleDelete() {
    if (!contact) return
    if (!confirm(`¿Eliminar a ${contact.legal_name}? Esta acción no se puede deshacer.`)) return
    await fetch(`/api/v1/contacts/${contact.id}`, { method: 'DELETE' })
    onSaved()
  }

  return (
    <dialog
      ref={dialogRef}
      className="m-auto w-full max-w-lg rounded bg-white p-0 shadow-xl backdrop:bg-black/40 open:flex open:flex-col"
      onCancel={onClose}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
        <h2 className="text-[15px] font-semibold text-zinc-900 tracking-tight">
          {isEdit ? 'Editar contacto' : 'Nuevo contacto'}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-700 transition-colors"
          aria-label="Cerrar"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M3 3l10 10M13 3L3 13"/>
          </svg>
        </button>
      </div>

      {/* Form */}
      <form key={`${contact?.id ?? 'new'}-${String(open)}`} onSubmit={handleSubmit} noValidate>
        <div className="px-5 py-4 flex flex-col gap-4">

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Tipo" htmlFor="type" required error={errors.type?.[0]}>
              <select
                id="type"
                name="type"
                defaultValue={contact?.type ?? 'customer'}
                className={cn(
                  'h-8 w-full rounded-sm border px-2.5 text-[13px] text-zinc-900 bg-white focus:outline-none focus:border-blue-500',
                  errors.type ? 'border-red-500' : 'border-zinc-300'
                )}
              >
                <option value="customer">Cliente</option>
                <option value="supplier">Proveedor</option>
                <option value="both">Ambos</option>
              </select>
            </FormField>

            <FormField label="Condición IVA" htmlFor="iva_condition" required error={errors.iva_condition?.[0]}>
              <select
                id="iva_condition"
                name="iva_condition"
                defaultValue={contact?.iva_condition ?? 'responsable_inscripto'}
                className={cn(
                  'h-8 w-full rounded-sm border px-2.5 text-[13px] text-zinc-900 bg-white focus:outline-none focus:border-blue-500',
                  errors.iva_condition ? 'border-red-500' : 'border-zinc-300'
                )}
              >
                <option value="responsable_inscripto">Responsable Inscripto</option>
                <option value="monotributista">Monotributista</option>
                <option value="consumidor_final">Consumidor Final</option>
                <option value="exento">Exento</option>
                <option value="no_responsable">No Responsable</option>
              </select>
            </FormField>
          </div>

          <FormField label="Razón social" htmlFor="legal_name" required error={errors.legal_name?.[0]}>
            <Input
              id="legal_name"
              name="legal_name"
              defaultValue={contact?.legal_name ?? ''}
              placeholder="Ej: Distribuidora Sur S.A."
              required
              error={!!errors.legal_name}
              disabled={saving}
            />
          </FormField>

          <FormField label="Nombre comercial" htmlFor="trade_name" error={errors.trade_name?.[0]}>
            <Input
              id="trade_name"
              name="trade_name"
              defaultValue={contact?.trade_name ?? ''}
              placeholder="Opcional"
              error={!!errors.trade_name}
              disabled={saving}
            />
          </FormField>

          <FormField label="CUIT" htmlFor="cuit" error={errors.cuit?.[0]}>
            <Input
              id="cuit"
              name="cuit"
              defaultValue={contact?.cuit ?? ''}
              placeholder="XX-XXXXXXXX-X"
              error={!!errors.cuit}
              disabled={saving}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Email" htmlFor="email" error={errors.email?.[0]}>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={contact?.email ?? ''}
                placeholder="contacto@empresa.com"
                error={!!errors.email}
                disabled={saving}
              />
            </FormField>

            <FormField label="Teléfono" htmlFor="phone" error={errors.phone?.[0]}>
              <Input
                id="phone"
                name="phone"
                defaultValue={contact?.phone ?? ''}
                placeholder="+54 9 261 000-0000"
                error={!!errors.phone}
                disabled={saving}
              />
            </FormField>
          </div>

          {serverError && (
            <p role="alert" className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2">
              {serverError}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-zinc-200 bg-zinc-50">
          <div>
            {isEdit && (
              <Button type="button" variant="danger" size="sm" onClick={handleDelete} disabled={saving}>
                Eliminar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear contacto'}
            </Button>
          </div>
        </div>
      </form>
    </dialog>
  )
}
