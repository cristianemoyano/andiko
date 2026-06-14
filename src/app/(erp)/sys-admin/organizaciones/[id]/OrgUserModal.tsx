'use client'

import { useMemo, useReducer, useState } from 'react'
import { Dialog } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { PasswordInput } from '@/components/primitives/PasswordInput'
import { FormField } from '@/components/primitives/FormField'
import type { BranchRow } from './BranchModal'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { fieldErrorsFromApiError } from '@/lib/validation-errors'

export interface OrgUserRow {
  id: string
  email: string
  name: string
  role: string
  is_active: boolean
  default_branch_id: string | null
  branch_ids: string[]
  created_at: string
  updated_at: string
}

const TENANT_ROLES = ['admin', 'operator', 'readonly'] as const
type TenantRole = (typeof TENANT_ROLES)[number]

const ROLE_LABEL: Record<TenantRole, string> = {
  admin: 'Administrador',
  operator: 'Operador',
  readonly: 'Solo lectura',
}

const selectClass =
  'flex h-8 w-full rounded-sm border border-zinc-300 bg-white px-2.5 text-[13px] text-zinc-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:border-blue-500 focus-visible:ring-offset-0'

interface OrgUserModalProps {
  open: boolean
  orgId: string
  branches: BranchRow[]
  user: OrgUserRow | null
  onClose: () => void
  onSaved: () => void
}

type FieldErrors = Record<string, string[]>

type BranchAccessState = { branchIds: string[]; defaultBranchId: string }

function branchAccessReducer(
  state: BranchAccessState,
  action: { type: 'toggle'; id: string } | { type: 'setDefault'; id: string },
): BranchAccessState {
  if (action.type === 'setDefault') {
    return { ...state, defaultBranchId: action.id }
  }
  const set = new Set(state.branchIds)
  if (set.has(action.id)) set.delete(action.id)
  else set.add(action.id)
  const branchIds = [...set]
  const defaultBranchId = branchIds.includes(state.defaultBranchId)
    ? state.defaultBranchId
    : branchIds[0] ?? ''
  return { branchIds, defaultBranchId }
}

interface OrgUserFormProps {
  orgId: string
  branches: BranchRow[]
  user: OrgUserRow | null
  onClose: () => void
  onSaved: () => void
}

function OrgUserForm({ orgId, branches, user, onClose, onSaved }: OrgUserFormProps) {
  const isEdit = user !== null
  const activeBranches = useMemo(() => branches.filter(b => b.is_active), [branches])

  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)

  const [email, setEmail] = useState(() => (isEdit ? user!.email : ''))
  const [name, setName] = useState(() => (isEdit ? user!.name : ''))
  const [password, setPassword] = useState('')
  const [posPin, setPosPin] = useState('')
  const [role, setRole] = useState<TenantRole>(() => (isEdit ? (user!.role as TenantRole) : 'operator'))
  const [branchAccess, dispatchBranch] = useReducer(
    branchAccessReducer,
    undefined,
    (): BranchAccessState => {
      const ids = isEdit ? [...user!.branch_ids] : []
      let def = ''
      if (isEdit && user!.default_branch_id && user!.branch_ids.includes(user.default_branch_id)) {
        def = user.default_branch_id
      } else if (isEdit && user!.branch_ids[0]) {
        def = user.branch_ids[0]
      }
      return { branchIds: ids, defaultBranchId: def }
    },
  )
  const { branchIds, defaultBranchId } = branchAccess
  const [isActive, setIsActive] = useState(() => (isEdit ? user!.is_active : true))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    setServerError(null)

    const ids = branchIds
    if (ids.length === 0) {
      setSaving(false)
      setServerError('Elegí al menos una sucursal.')
      return
    }
    let def = defaultBranchId
    if (!def || !ids.includes(def)) {
      def = ids[0] ?? ''
    }

    if (isEdit) {
      const body: Record<string, unknown> = {
        name: name.trim(),
        role,
        branchIds: ids,
        defaultBranchId: def,
        is_active: isActive,
      }
      if (password.trim()) body.password = password.trim()
      if (posPin.trim()) body.posPin = posPin.trim()

      try {
        await fetchJson(`/api/v1/sys-admin/organizations/${orgId}/users/${user!.id}`, {
          method: 'PATCH',
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
      return
    }

    if (!password.trim() || password.trim().length < 8) {
      setSaving(false)
      setErrors({ password: ['La contraseña debe tener al menos 8 caracteres'] })
      return
    }

    try {
      await fetchJson(`/api/v1/sys-admin/organizations/${orgId}/users`, {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: name.trim(),
          password: password.trim(),
          posPin: posPin.trim() ? posPin.trim() : undefined,
          role,
          branchIds: ids,
          defaultBranchId: def,
        }),
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

  if (activeBranches.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[13px] text-zinc-600">
          Creá al menos una sucursal activa antes de agregar usuarios.
        </p>
        <div className="flex justify-end">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {!isEdit && (
        <FormField label="Email" htmlFor="org_user_email" error={errors.email?.[0]}>
          <Input
            id="org_user_email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="off"
            error={!!errors.email}
          />
        </FormField>
      )}
      {isEdit && (
        <FormField label="Email" htmlFor="org_user_email_ro">
          <Input id="org_user_email_ro" value={email} readOnly className="bg-zinc-50 text-zinc-600" />
        </FormField>
      )}
      <FormField label="Nombre" htmlFor="org_user_name" error={errors.name?.[0]}>
        <Input
          id="org_user_name"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          error={!!errors.name}
        />
      </FormField>
      <FormField
        label={isEdit ? 'Nueva contraseña (opcional)' : 'Contraseña'}
        htmlFor="org_user_password"
        error={errors.password?.[0]}
      >
        <PasswordInput
          id="org_user_password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="new-password"
          required={!isEdit}
          error={!!errors.password}
        />
      </FormField>

      <FormField label="PIN de POS (opcional)" htmlFor="org_user_pos_pin" error={errors.posPin?.[0]}>
        <PasswordInput
          id="org_user_pos_pin"
          value={posPin}
          onChange={e => setPosPin(e.target.value)}
          autoComplete="off"
          placeholder={isEdit ? 'Dejar vacío para no cambiar' : 'Opcional'}
          error={!!errors.posPin}
        />
      </FormField>
      <FormField label="Rol" htmlFor="org_user_role" error={errors.role?.[0]}>
        <select
          id="org_user_role"
          value={role}
          onChange={e => setRole(e.target.value as TenantRole)}
          className={selectClass}
        >
          {TENANT_ROLES.map(r => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </FormField>

      <div>
        <p className="text-[12px] font-medium text-zinc-800 mb-2">Sucursales permitidas</p>
        <ul className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto rounded-sm border border-zinc-200 p-2">
          {activeBranches.map(b => (
            <li key={b.id}>
              <label className="flex items-center gap-2 text-[13px] text-zinc-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={branchIds.includes(b.id)}
                  onChange={() => dispatchBranch({ type: 'toggle', id: b.id })}
                  className="rounded border-zinc-300"
                />
                <span>{`${String(b.branch_code).padStart(2, '0')} — ${b.name}`}</span>
              </label>
            </li>
          ))}
        </ul>
        {errors.branchIds?.[0] && (
          <p className="text-[11px] text-red-600 mt-1">{errors.branchIds[0]}</p>
        )}
      </div>

      <FormField label="Sucursal por defecto" htmlFor="org_user_default_branch" error={errors.defaultBranchId?.[0]}>
        <select
          id="org_user_default_branch"
          value={defaultBranchId}
          onChange={e => dispatchBranch({ type: 'setDefault', id: e.target.value })}
          className={selectClass}
        >
          <option value="">— Elegí —</option>
          {branchIds.map(id => {
            const b = activeBranches.find(x => x.id === id)
            return b ? (
              <option key={id} value={id}>
                {`${String(b.branch_code).padStart(2, '0')} — ${b.name}`}
              </option>
            ) : null
          })}
        </select>
      </FormField>

      {isEdit && (
        <label className="flex items-center gap-2 text-[13px] text-zinc-700 cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={e => setIsActive(e.target.checked)}
            className="rounded border-zinc-300"
          />
          Usuario activo
        </label>
      )}

      {serverError && (
        <p role="alert" className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2">
          {serverError}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? 'Guardando…' : isEdit ? 'Guardar' : 'Crear usuario'}
        </Button>
      </div>
    </form>
  )
}

export function OrgUserModal({ open, orgId, branches, user, onClose, onSaved }: OrgUserModalProps) {
  const formKey = user?.id ?? 'new'
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
      title={user ? 'Editar usuario' : 'Nuevo usuario'}
      size="md"
    >
      {open ? (
        <OrgUserForm key={formKey} orgId={orgId} branches={branches} user={user} onClose={onClose} onSaved={onSaved} />
      ) : null}
    </Dialog>
  )
}
