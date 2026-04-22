'use client'

import { useState } from 'react'
import { Dialog } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Textarea } from '@/components/primitives/Textarea'
import { FormField } from '@/components/primitives/FormField'

export interface BranchRow {
  id: string
  org_id: string
  branch_code: number
  name: string
  address: string | null
  is_active: boolean
}

interface BranchModalProps {
  open: boolean
  orgId: string
  branch: BranchRow | null
  onClose: () => void
  onSaved: () => void
}

type FieldErrors = Record<string, string[]>

interface BranchModalFormProps {
  orgId: string
  branch: BranchRow | null
  onClose: () => void
  onSaved: () => void
}

function BranchModalForm({ orgId, branch, onClose, onSaved }: BranchModalFormProps) {
  const isEdit = branch !== null
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [name, setName] = useState(() => branch?.name ?? '')
  const [address, setAddress] = useState(() => branch?.address ?? '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    setServerError(null)

    const url = isEdit
      ? `/api/v1/sys-admin/branches/${branch!.id}`
      : `/api/v1/sys-admin/organizations/${orgId}/branches`
    const method = isEdit ? 'PATCH' : 'POST'
    const body = isEdit
      ? { name: name.trim(), address: address.trim() || null }
      : { name: name.trim(), address: address.trim() || null }

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    setSaving(false)

    if (res.ok) {
      onSaved()
      onClose()
      return
    }

    const data = await res.json() as { code: string; details?: { fieldErrors?: FieldErrors }; error?: string }
    if (data.code === 'VALIDATION_ERROR' && data.details?.fieldErrors) {
      setErrors(data.details.fieldErrors)
    } else {
      setServerError(data.error ?? 'Error al guardar.')
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="flex flex-col gap-4">
        <FormField label="Nombre" htmlFor="branch_name" error={errors.name?.[0]}>
          <Input
            id="branch_name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            error={!!errors.name}
          />
        </FormField>
        <FormField label="Dirección (opcional)" htmlFor="branch_address" error={errors.address?.[0]}>
          <Textarea id="branch_address" value={address} onChange={e => setAddress(e.target.value)} rows={3} />
        </FormField>
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
            {saving ? 'Guardando…' : isEdit ? 'Guardar' : 'Crear'}
          </Button>
        </div>
      </div>
    </form>
  )
}

export function BranchModal({ open, orgId, branch, onClose, onSaved }: BranchModalProps) {
  const isEdit = branch !== null
  const formKey = branch?.id ?? 'new'

  return (
    <Dialog
      open={open}
      onOpenChange={v => {
        if (!v) onClose()
      }}
      title={isEdit ? `Editar sucursal` : 'Nueva sucursal'}
      size="md"
    >
      {open ? (
        <BranchModalForm key={formKey} orgId={orgId} branch={branch} onClose={onClose} onSaved={onSaved} />
      ) : null}
    </Dialog>
  )
}
