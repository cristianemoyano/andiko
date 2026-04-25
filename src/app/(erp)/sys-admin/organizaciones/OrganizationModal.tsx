'use client'

import { useState } from 'react'
import { Dialog } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { FormField } from '@/components/primitives/FormField'
import { slugifyText } from '@/lib/slug'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { fieldErrorsFromApiError } from '@/lib/validation-errors'

interface OrganizationModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

type FieldErrors = Record<string, string[]>

export function OrganizationModal({ open, onClose, onSaved }: OrganizationModalProps) {
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)

  function handleNameBlur() {
    if (!slugTouched && name.trim()) {
      setSlug(slugifyText(name))
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    setServerError(null)

    const body: { name: string; slug?: string } = { name: name.trim() }
    const s = slug.trim()
    if (s) body.slug = s

    try {
      await fetchJson('/api/v1/sys-admin/organizations', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      setName('')
      setSlug('')
      setSlugTouched(false)
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
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }} title="Nueva organización" size="md">
      <form onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-4">
          <FormField label="Nombre" htmlFor="org_name" error={errors.name?.[0]}>
            <Input
              id="org_name"
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={handleNameBlur}
              placeholder="Razón social"
              error={!!errors.name}
              required
            />
          </FormField>
          <FormField
            label="Slug (opcional)"
            htmlFor="org_slug"
            error={errors.slug?.[0]}
          >
            <Input
              id="org_slug"
              value={slug}
              onChange={e => { setSlugTouched(true); setSlug(e.target.value) }}
              placeholder="mi-empresa (minúsculas y guiones)"
              error={!!errors.slug}
            />
          </FormField>
          <p className="text-[12px] text-zinc-500">
            Si lo dejás vacío, se genera a partir del nombre. Si el slug está ocupado, se agrega un sufijo automático.
          </p>
          {serverError && (
            <p role="alert" className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2">
              {serverError}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? 'Creando…' : 'Crear'}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  )
}
