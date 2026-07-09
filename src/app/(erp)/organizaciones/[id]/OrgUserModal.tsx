'use client'

import { useEffect, useMemo, useReducer, useState } from 'react'
import { Dialog } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { PasswordInput } from '@/components/primitives/PasswordInput'
import { FormField } from '@/components/primitives/FormField'
import { Checkbox } from '@/components/primitives/Checkbox'
import { Select } from '@/components/primitives/Select'
import { cn } from '@/lib/utils'
import type { BranchRow } from './BranchModal'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { fieldErrorsFromApiError } from '@/lib/validation-errors'
import { orgApiPaths, type OrgApiNamespace } from '@/lib/org-api-paths'
import {
  ASSIGNABLE_BUILTIN_ROLES,
  getBuiltinRoleLabel,
  isLegacyBuiltinRole,
  type AssignableBuiltinRole,
} from '@/modules/auth/role-labels'
import type { UserRole } from '@/types/roles'

export interface OrgUserRow {
  id: string
  email: string
  name: string
  first_name: string
  last_name: string
  role: string
  org_role_id?: string | null
  org_role_name?: string | null
  is_active: boolean
  default_branch_id: string | null
  branch_ids: string[]
  created_at: string
  updated_at: string
}

type BuiltinRole = AssignableBuiltinRole | Extract<UserRole, 'operator' | 'readonly'>

type RoleSelection =
  | { kind: 'builtin'; role: BuiltinRole }
  | { kind: 'custom'; orgRoleId: string }

interface MatrixColumn {
  kind: 'builtin' | 'custom'
  role?: BuiltinRole
  id?: string
  label?: string
  name?: string
}

interface RoleMatrixPayload {
  columns: MatrixColumn[]
}

interface OrgUserModalProps {
  open: boolean
  orgId: string
  apiNamespace: OrgApiNamespace
  branches: BranchRow[]
  user: OrgUserRow | null
  onClose: () => void
  onSaved: () => void
}

type FieldErrors = Record<string, string[]>

type BranchAccessState = { branchIds: string[]; defaultBranchId: string }

function branchAccessReducer(
  state: BranchAccessState,
  action:
    | { type: 'toggle'; id: string }
    | { type: 'setDefault'; id: string }
    | { type: 'setSingle'; id: string },
): BranchAccessState {
  if (action.type === 'setDefault') {
    return { ...state, defaultBranchId: action.id }
  }
  if (action.type === 'setSingle') {
    return { branchIds: [action.id], defaultBranchId: action.id }
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

function initialRoleSelection(user: OrgUserRow | null): RoleSelection {
  if (!user) return { kind: 'custom', orgRoleId: '' }
  if (user.org_role_id) return { kind: 'custom', orgRoleId: user.org_role_id }
  if (
    user.role === 'admin'
    || user.role === 'branch-admin'
    || user.role === 'readonly'
    || isLegacyBuiltinRole(user.role)
  ) {
    return { kind: 'builtin', role: user.role as BuiltinRole }
  }
  return { kind: 'custom', orgRoleId: '' }
}

function roleSelectValue(selection: RoleSelection): string {
  if (selection.kind === 'custom') {
    return selection.orgRoleId ? `custom:${selection.orgRoleId}` : ''
  }
  return `builtin:${selection.role}`
}

function parseRoleSelectValue(value: string): RoleSelection {
  if (value.startsWith('custom:')) {
    return { kind: 'custom', orgRoleId: value.slice('custom:'.length) }
  }
  return { kind: 'builtin', role: value.slice('builtin:'.length) as BuiltinRole }
}

interface OrgUserFormProps {
  orgId: string
  apiNamespace: OrgApiNamespace
  branches: BranchRow[]
  user: OrgUserRow | null
  onClose: () => void
  onSaved: () => void
}

function OrgUserForm({ orgId, apiNamespace, branches, user, onClose, onSaved }: OrgUserFormProps) {
  const isEdit = user !== null
  const activeBranches = useMemo(() => branches.filter(b => b.is_active), [branches])
  const api = orgApiPaths(apiNamespace, orgId)

  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [roleOptions, setRoleOptions] = useState<{ value: string; label: string }[]>([])

  const [email, setEmail] = useState(() => (isEdit ? user!.email : ''))
  const [firstName, setFirstName] = useState(() => (isEdit ? user!.first_name : ''))
  const [lastName, setLastName] = useState(() => (isEdit ? user!.last_name : ''))
  const [password, setPassword] = useState('')
  const [posPin, setPosPin] = useState('')
  const [roleSelection, setRoleSelection] = useState<RoleSelection>(() => initialRoleSelection(user))
  const [branchAccess, dispatchBranch] = useReducer(
    branchAccessReducer,
    undefined,
    (): BranchAccessState => {
      const ids = isEdit ? [...user!.branch_ids] : []
      let def = ''
      if (isEdit && user!.default_branch_id && user!.branch_ids.includes(user!.default_branch_id)) {
        def = user!.default_branch_id
      } else if (isEdit && user!.branch_ids[0]) {
        def = user!.branch_ids[0]
      }
      return { branchIds: ids, defaultBranchId: def }
    },
  )
  const { branchIds, defaultBranchId } = branchAccess
  const [isActive, setIsActive] = useState(() => (isEdit ? user!.is_active : true))

  const isBranchAdmin = roleSelection.kind === 'builtin' && roleSelection.role === 'branch-admin'

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const matrix = await fetchJson<RoleMatrixPayload>(api.rolesMatrix)
        if (cancelled) return
        const opts = matrix.columns.map(col => {
          if (col.kind === 'builtin' && col.role) {
            return { value: `builtin:${col.role}`, label: col.label ?? getBuiltinRoleLabel(col.role) }
          }
          if (col.kind === 'custom' && col.id) {
            return { value: `custom:${col.id}`, label: col.name ?? 'Rol custom' }
          }
          return null
        }).filter((o): o is { value: string; label: string } => o !== null)
        if (isEdit && user && !user.org_role_id && isLegacyBuiltinRole(user.role)) {
          const legacyValue = `builtin:${user.role}`
          if (!opts.some(o => o.value === legacyValue)) {
            opts.push({ value: legacyValue, label: getBuiltinRoleLabel(user.role) })
          }
        }

        setRoleOptions(opts)

        if (!isEdit) {
          const vendedor = opts.find(o => o.label === 'Vendedor')
          if (vendedor) setRoleSelection(parseRoleSelectValue(vendedor.value))
          else {
            const gerente = opts.find(o => o.value === 'builtin:admin')
            if (gerente) setRoleSelection({ kind: 'builtin', role: 'admin' })
          }
        }
      } catch {
        if (!cancelled) {
          setRoleOptions(
            ASSIGNABLE_BUILTIN_ROLES.map(r => ({
              value: `builtin:${r}`,
              label: getBuiltinRoleLabel(r),
            })),
          )
        }
      }
    })()
    return () => { cancelled = true }
  }, [api.rolesMatrix, isEdit, user])

  useEffect(() => {
    if (isBranchAdmin && branchIds.length > 1) {
      const first = branchIds[0]
      if (first) dispatchBranch({ type: 'setSingle', id: first })
    }
  }, [isBranchAdmin, branchIds.length, branchIds])

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
    if (isBranchAdmin && ids.length !== 1) {
      setSaving(false)
      setServerError('Encargado de sucursal debe tener exactamente una sucursal.')
      return
    }
    let def = defaultBranchId
    if (!def || !ids.includes(def)) {
      def = ids[0] ?? ''
    }

    if (roleSelection.kind === 'custom' && !roleSelection.orgRoleId) {
      setSaving(false)
      setServerError('Elegí un rol.')
      return
    }

    const shared = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      branchIds: ids,
      defaultBranchId: def,
    }

    if (isEdit) {
      const body: Record<string, unknown> = { ...shared, is_active: isActive }
      if (password.trim()) body.password = password.trim()
      if (posPin.trim()) body.posPin = posPin.trim()
      if (roleSelection.kind === 'custom') {
        body.roleKind = 'custom'
        body.orgRoleId = roleSelection.orgRoleId
      } else {
        body.roleKind = 'builtin'
        body.role = roleSelection.role
      }

      try {
        await fetchJson(api.user(user!.id), {
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

    const createBody =
      roleSelection.kind === 'custom'
        ? {
            roleKind: 'custom' as const,
            orgRoleId: roleSelection.orgRoleId,
            email: email.trim().toLowerCase(),
            password: password.trim(),
            posPin: posPin.trim() ? posPin.trim() : undefined,
            ...shared,
          }
        : {
            roleKind: 'builtin' as const,
            role: roleSelection.role,
            email: email.trim().toLowerCase(),
            password: password.trim(),
            posPin: posPin.trim() ? posPin.trim() : undefined,
            ...shared,
          }

    try {
      await fetchJson(api.users, {
        method: 'POST',
        body: JSON.stringify(createBody),
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
        <p className="text-[13px] text-fg-muted">
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
          <Input id="org_user_email_ro" value={email} readOnly className="bg-surface-muted text-fg-muted" />
        </FormField>
      )}
      <FormField label="Nombre" htmlFor="org_user_first_name" error={errors.firstName?.[0] ?? errors.name?.[0]}>
        <Input
          id="org_user_first_name"
          value={firstName}
          onChange={e => setFirstName(e.target.value)}
          required
          autoComplete="given-name"
          error={!!(errors.firstName ?? errors.name)}
        />
      </FormField>
      <FormField label="Apellido" htmlFor="org_user_last_name" error={errors.lastName?.[0]}>
        <Input
          id="org_user_last_name"
          value={lastName}
          onChange={e => setLastName(e.target.value)}
          autoComplete="family-name"
          error={!!errors.lastName}
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
        <Select
          id="org_user_role"
          value={roleSelectValue(roleSelection)}
          onChange={v => setRoleSelection(parseRoleSelectValue(v))}
          options={roleOptions}
          placeholder="Elegí un rol"
          disabled={roleOptions.length === 0}
          error={!!errors.role}
        />
      </FormField>

      <div>
        <p className="text-[12px] font-medium text-fg-muted mb-2">
          {isBranchAdmin ? 'Sucursal asignada' : 'Sucursales permitidas'}
        </p>
        <ul className="flex flex-col gap-1 max-h-[180px] overflow-y-auto rounded-sm border border-border p-2">
          {activeBranches.map(b => {
            const label = `${String(b.branch_code).padStart(2, '0')} — ${b.name}`
            if (isBranchAdmin) {
              const selected = branchIds.includes(b.id)
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => dispatchBranch({ type: 'setSingle', id: b.id })}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left text-[13px] transition-colors',
                      selected
                        ? 'bg-brand-accent-bg text-brand-accent ring-1 ring-brand-accent-border'
                        : 'text-fg hover:bg-surface-muted',
                    )}
                  >
                    <span
                      className={cn(
                        'h-3.5 w-3.5 flex-shrink-0 rounded-full border',
                        selected ? 'border-brand-600 bg-brand-600' : 'border-border-strong bg-surface',
                      )}
                      aria-hidden
                    />
                    <span>{label}</span>
                  </button>
                </li>
              )
            }
            return (
              <li key={b.id}>
                <Checkbox
                  checked={branchIds.includes(b.id)}
                  onCheckedChange={() => dispatchBranch({ type: 'toggle', id: b.id })}
                  label={label}
                />
              </li>
            )
          })}
        </ul>
        {errors.branchIds?.[0] && (
          <p className="text-[11px] text-danger mt-1">{errors.branchIds[0]}</p>
        )}
      </div>

      {!isBranchAdmin && (
        <FormField label="Sucursal por defecto" htmlFor="org_user_default_branch" error={errors.defaultBranchId?.[0]}>
          <Select
            id="org_user_default_branch"
            value={defaultBranchId}
            onChange={id => dispatchBranch({ type: 'setDefault', id })}
            options={branchIds.flatMap(id => {
              const b = activeBranches.find(x => x.id === id)
              return b
                ? [{ value: id, label: `${String(b.branch_code).padStart(2, '0')} — ${b.name}` }]
                : []
            })}
            placeholder="— Elegí —"
            disabled={branchIds.length === 0}
            error={!!errors.defaultBranchId}
          />
        </FormField>
      )}

      {isEdit && (
        <Checkbox
          checked={isActive}
          onCheckedChange={checked => setIsActive(checked === true)}
          label="Usuario activo"
        />
      )}

      {serverError && (
        <p role="alert" className="text-[12px] text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">
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

export function OrgUserModal({ open, orgId, apiNamespace, branches, user, onClose, onSaved }: OrgUserModalProps) {
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
        <OrgUserForm
          key={formKey}
          orgId={orgId}
          apiNamespace={apiNamespace}
          branches={branches}
          user={user}
          onClose={onClose}
          onSaved={onSaved}
        />
      ) : null}
    </Dialog>
  )
}
