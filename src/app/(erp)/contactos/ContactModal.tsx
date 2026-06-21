'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { FormField } from '@/components/primitives/FormField'
import { cn } from '@/lib/utils'
import { fetchJson, getApiErrorMessage, isApiRequestError } from '@/lib/fetch-json'
import { notifyApiError, notifySuccess } from '@/lib/notify'
import { fieldErrorsFromApiError } from '@/lib/validation-errors'

type Contact = {
  id: string
  type: 'customer' | 'supplier' | 'both'
  legal_name: string
  trade_name: string | null
  first_name: string | null
  last_name: string | null
  job_title: string | null
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
      first_name:    form.get('first_name') || null,
      last_name:     form.get('last_name') || null,
      job_title:     form.get('job_title') || null,
      cuit:          form.get('cuit') || null,
      iva_condition: form.get('iva_condition'),
      email:         form.get('email') || null,
      phone:         form.get('phone') || null,
      ...(isEdit ? { is_active: form.get('is_active') === 'on' } : {}),
    }

    const url    = isEdit ? `/api/v1/contacts/${contact.id}` : '/api/v1/contacts'
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
      if (isApiRequestError(err) && err.code === 'DUPLICATE_CUIT') {
        setErrors({ cuit: ['El CUIT ya está registrado.'] })
        return
      }
      setServerError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!contact) return
    if (!confirm(`¿Eliminar a ${contact.legal_name}? Esta acción no se puede deshacer.`)) return
    try {
      await fetchJson(`/api/v1/contacts/${contact.id}`, { method: 'DELETE' })
      notifySuccess('Contacto eliminado')
      onSaved()
    } catch (err) {
      notifyApiError(err)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      data-testid="contact-modal"
      className="m-auto w-full max-w-lg rounded bg-surface p-0 shadow-xl backdrop:bg-black/40 open:flex open:flex-col"
      onCancel={onClose}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="text-[15px] font-semibold text-fg tracking-tight">
          {isEdit ? 'Editar contacto' : 'Nuevo contacto'}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-fg-subtle hover:text-fg-muted transition-colors"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Tipo" htmlFor="type" required error={errors.type?.[0]}>
              <select
                id="type"
                name="type"
                defaultValue={contact?.type ?? 'customer'}
                className={cn(
                  'h-8 w-full rounded-sm border px-2.5 text-[13px] text-fg bg-surface focus:outline-none focus:border-ring',
                  errors.type ? 'border-danger' : 'border-border-strong'
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
                  'h-8 w-full rounded-sm border px-2.5 text-[13px] text-fg bg-surface focus:outline-none focus:border-ring',
                  errors.iva_condition ? 'border-danger' : 'border-border-strong'
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

          <p className="text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Persona de contacto</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Nombre" htmlFor="first_name" error={errors.first_name?.[0]}>
              <Input
                id="first_name"
                name="first_name"
                defaultValue={contact?.first_name ?? ''}
                placeholder="Opcional"
                error={!!errors.first_name}
                disabled={saving}
              />
            </FormField>
            <FormField label="Apellido" htmlFor="last_name" error={errors.last_name?.[0]}>
              <Input
                id="last_name"
                name="last_name"
                defaultValue={contact?.last_name ?? ''}
                placeholder="Opcional"
                error={!!errors.last_name}
                disabled={saving}
              />
            </FormField>
          </div>

          <FormField label="Puesto en la empresa" htmlFor="job_title" error={errors.job_title?.[0]}>
            <Input
              id="job_title"
              name="job_title"
              defaultValue={contact?.job_title ?? ''}
              placeholder="Ej: Compras, Administración"
              error={!!errors.job_title}
              disabled={saving}
            />
          </FormField>

          <FormField label="CUIT" htmlFor="cuit" error={errors.cuit?.[0]} errorTestId="cuit-error">
            <Input
              id="cuit"
              name="cuit"
              defaultValue={contact?.cuit ?? ''}
              placeholder="XX-XXXXXXXX-X"
              error={!!errors.cuit}
              disabled={saving}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          {isEdit && (
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={contact?.is_active ?? true}
                className="w-4 h-4 rounded-sm accent-brand-600 cursor-pointer"
              />
              <span className="text-[13px] text-fg-muted">Contacto activo</span>
            </label>
          )}

          {serverError && (
            <p role="alert" className="text-[12px] text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">
              {serverError}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border bg-surface-muted">
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
            <Button type="submit" size="sm" data-testid="contact-save-btn" disabled={saving}>
              {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear contacto'}
            </Button>
          </div>
        </div>
      </form>
    </dialog>
  )
}
