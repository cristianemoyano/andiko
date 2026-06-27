'use client'

import { useState } from 'react'
import { Dialog } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { FormField } from '@/components/primitives/FormField'
import { AddressFields, EMPTY_ADDRESS, type AddressValue } from '@/components/erp'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { fieldErrorsFromApiError } from '@/lib/validation-errors'
import { orgApiPaths, type OrgApiNamespace } from '@/lib/org-api-paths'

export interface BranchRow {
  id: string
  org_id: string
  branch_code: number
  name: string
  address: string | null
  street?: string | null
  number?: string | null
  floor?: string | null
  apartment?: string | null
  city?: string | null
  province?: string | null
  postal_code?: string | null
  country?: string | null
  is_active: boolean
}

function branchToAddress(branch: BranchRow | null): AddressValue {
  if (!branch) return EMPTY_ADDRESS
  return {
    street: branch.street ?? '',
    number: branch.number ?? '',
    floor: branch.floor ?? '',
    apartment: branch.apartment ?? '',
    city: branch.city ?? '',
    province: branch.province ?? '',
    postal_code: branch.postal_code ?? '',
    country: branch.country ?? 'Argentina',
  }
}

interface BranchModalProps {
  open: boolean
  orgId: string
  apiNamespace: OrgApiNamespace
  branch: BranchRow | null
  onClose: () => void
  onSaved: () => void
}

type FieldErrors = Record<string, string[]>

interface BranchModalFormProps {
  orgId: string
  apiNamespace: OrgApiNamespace
  branch: BranchRow | null
  onClose: () => void
  onSaved: () => void
}

function BranchModalForm({ orgId, apiNamespace, branch, onClose, onSaved }: BranchModalFormProps) {
  const isEdit = branch !== null
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [name, setName] = useState(() => branch?.name ?? '')
  const [address, setAddress] = useState<AddressValue>(() => branchToAddress(branch))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    setServerError(null)

    const api = orgApiPaths(apiNamespace, orgId)
    const url = isEdit ? api.branch(branch!.id) : api.branches
    const method = isEdit ? 'PATCH' : 'POST'
    const addressBody = {
      street: address.street.trim() || null,
      number: address.number.trim() || null,
      floor: address.floor.trim() || null,
      apartment: address.apartment.trim() || null,
      city: address.city.trim() || null,
      province: address.province.trim() || null,
      postal_code: address.postal_code.trim() || null,
      country: address.country.trim() || null,
    }
    const body = { name: name.trim(), ...addressBody }

    try {
      await fetchJson(url, {
        method,
        body: JSON.stringify(body),
      })
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
        <div>
          <p className="text-[12px] font-medium text-fg-muted mb-2">Dirección (opcional)</p>
          <AddressFields
            value={address}
            onChange={setAddress}
            idPrefix="branch_address"
            errors={{
              street: errors.street?.[0],
              number: errors.number?.[0],
              floor: errors.floor?.[0],
              apartment: errors.apartment?.[0],
              city: errors.city?.[0],
              province: errors.province?.[0],
              postal_code: errors.postal_code?.[0],
              country: errors.country?.[0],
            }}
          />
        </div>
        {serverError && (
          <p role="alert" className="text-[12px] text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">
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

export function BranchModal({ open, orgId, apiNamespace, branch, onClose, onSaved }: BranchModalProps) {
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
        <BranchModalForm key={formKey} orgId={orgId} apiNamespace={apiNamespace} branch={branch} onClose={onClose} onSaved={onSaved} />
      ) : null}
    </Dialog>
  )
}
