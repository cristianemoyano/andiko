'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Dialog } from '@/components/primitives/Dialog'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { orgApiPaths, type OrgApiNamespace } from '@/lib/org-api-paths'
import type { MatrixPermission } from '@/lib/permissions'
import type { UserRole } from '@/types/roles'
import { useCapabilities } from '@/components/layout/CapabilitiesContext'

type MatrixColumn =
  | { kind: 'builtin'; role: UserRole; label: string; readonly: true }
  | { kind: 'custom'; id: string; name: string; allows_pos: boolean; user_count: number; readonly: false }

interface MatrixPayload {
  permissions: Array<{ name: MatrixPermission; label: string; group: string }>
  columns: MatrixColumn[]
  grants: Record<string, MatrixPermission[]>
}

const MODULE_GROUP_LABELS: Record<string, string> = {
  panel: 'Panel',
  contacts: 'Contactos',
  products: 'Productos',
  sales: 'Ventas',
  inventory: 'Inventario',
  purchases: 'Compras',
  accounting: 'Contabilidad',
}

const MODULE_GROUP_ORDER = [
  'panel',
  'contacts',
  'products',
  'sales',
  'inventory',
  'purchases',
  'accounting',
] as const

interface RolePermissionMatrixProps {
  orgId: string
  apiNamespace: OrgApiNamespace
  canEdit: boolean
}

export function RolePermissionMatrix({ orgId, apiNamespace, canEdit }: RolePermissionMatrixProps) {
  const api = orgApiPaths(apiNamespace, orgId)
  const { refreshCapabilities } = useCapabilities()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [matrix, setMatrix] = useState<MatrixPayload | null>(null)
  const [draft, setDraft] = useState<Record<string, Set<MatrixPermission>>>({})
  const [dirty, setDirty] = useState(false)
  const [newRoleOpen, setNewRoleOpen] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [deleteRole, setDeleteRole] = useState<{ id: string; name: string } | null>(null)
  const [moduleFilter, setModuleFilter] = useState<string | null>(null)
  const [showAllModules, setShowAllModules] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchJson<MatrixPayload>(api.rolesMatrix)
      setMatrix(data)
      const next: Record<string, Set<MatrixPermission>> = {}
      for (const col of data.columns) {
        if (col.kind === 'custom') {
          next[col.id] = new Set(data.grants[col.id] ?? [])
        }
      }
      setDraft(next)
      setDirty(false)
    } catch (e) {
      setError(getApiErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [api.rolesMatrix])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchJson<MatrixPayload>(api.rolesMatrix)
        if (cancelled) return
        setMatrix(data)
        const next: Record<string, Set<MatrixPermission>> = {}
        for (const col of data.columns) {
          if (col.kind === 'custom') {
            next[col.id] = new Set(data.grants[col.id] ?? [])
          }
        }
        setDraft(next)
        setDirty(false)
      } catch (e) {
        if (!cancelled) setError(getApiErrorMessage(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [api.rolesMatrix])

  const customColumns = useMemo(
    () => matrix?.columns.filter((c): c is Extract<MatrixColumn, { kind: 'custom' }> => c.kind === 'custom') ?? [],
    [matrix],
  )

  const moduleGroups = useMemo(() => {
    if (!matrix) return []
    const groups = [...new Set(matrix.permissions.map(p => p.group))]
    return groups.sort((a, b) => {
      const ai = MODULE_GROUP_ORDER.indexOf(a as (typeof MODULE_GROUP_ORDER)[number])
      const bi = MODULE_GROUP_ORDER.indexOf(b as (typeof MODULE_GROUP_ORDER)[number])
      if (ai === -1 && bi === -1) return a.localeCompare(b)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
  }, [matrix])

  const activeModuleFilter = showAllModules ? null : (moduleFilter ?? moduleGroups[0] ?? null)

  const filteredPermissions = useMemo(() => {
    if (!matrix) return []
    if (!activeModuleFilter) return matrix.permissions
    return matrix.permissions.filter(p => p.group === activeModuleFilter)
  }, [matrix, activeModuleFilter])

  const grouped = useMemo(
    () => filteredPermissions.reduce<Record<string, typeof filteredPermissions>>((acc, p) => {
      acc[p.group] = acc[p.group] ?? []
      acc[p.group].push(p)
      return acc
    }, {}),
    [filteredPermissions],
  )

  const moduleFilterActive = activeModuleFilter !== null
  const totalPermissions = matrix?.permissions.length ?? 0

  function toggleGrant(roleId: string, permission: MatrixPermission) {
    if (!canEdit) return
    setDraft(prev => {
      const set = new Set(prev[roleId] ?? [])
      if (set.has(permission)) set.delete(permission)
      else set.add(permission)
      return { ...prev, [roleId]: set }
    })
    setDirty(true)
  }

  async function handleSave() {
    if (!matrix) return
    setSaving(true)
    setError(null)
    try {
      const updates = customColumns.map(col => ({
        orgRoleId: col.id,
        permissionNames: [...(draft[col.id] ?? [])],
      }))
      const data = await fetchJson<MatrixPayload>(api.rolesMatrix, {
        method: 'PATCH',
        body: JSON.stringify({ updates }),
      })
      setMatrix(data)
      setDirty(false)
      void refreshCapabilities()
    } catch (e) {
      setError(getApiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateRole(e: React.FormEvent) {
    e.preventDefault()
    const name = newRoleName.trim()
    if (!name) return
    setSaving(true)
    try {
      await fetchJson(api.roles, {
        method: 'POST',
        body: JSON.stringify({ name }),
      })
      setNewRoleOpen(false)
      setNewRoleName('')
      await load()
      void refreshCapabilities()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteRole() {
    if (!deleteRole) return
    setSaving(true)
    try {
      await fetchJson(api.role(deleteRole.id), { method: 'DELETE' })
      setDeleteRole(null)
      await load()
      void refreshCapabilities()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-[13px] text-fg-muted">Cargando matriz de permisos…</p>
  }

  if (!matrix) {
    return error ? <p role="alert" className="text-[12px] text-danger">{error}</p> : null
  }

  function clearModuleFilter() {
    setShowAllModules(true)
    setModuleFilter(null)
  }

  function selectModuleGroup(group: string) {
    if (!showAllModules && moduleFilter === group) {
      clearModuleFilter()
      return
    }
    setShowAllModules(false)
    setModuleFilter(group)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide">Roles y permisos</p>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {canEdit && (
            <Button size="sm" variant="secondary" onClick={() => setNewRoleOpen(true)}>
              + Nuevo rol
            </Button>
          )}
          {canEdit && dirty && (
            <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar permisos'}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {moduleGroups.map(group => (
            <button
              key={group}
              type="button"
              onClick={() => selectModuleGroup(group)}
              className={`rounded-sm border px-2 py-0.5 text-[11px] transition-colors ${
                !showAllModules && activeModuleFilter === group
                  ? 'border-brand-600 bg-brand-50 text-brand-800'
                  : 'border-border bg-surface text-fg-muted hover:bg-surface-muted'
              }`}
            >
              {MODULE_GROUP_LABELS[group] ?? group}
            </button>
          ))}
          <button
            type="button"
            onClick={clearModuleFilter}
            className={`rounded-sm border px-2 py-0.5 text-[11px] transition-colors ${
              showAllModules
                ? 'border-brand-600 bg-brand-50 text-brand-800'
                : 'border-border bg-surface text-fg-muted hover:bg-surface-muted'
            }`}
          >
            Todos
          </button>
          {moduleFilterActive && (
            <button
              type="button"
              onClick={clearModuleFilter}
              className="text-[11px] text-fg-muted underline-offset-2 hover:underline"
            >
              Ver todos
            </button>
          )}
        </div>
        {moduleFilterActive && (
          <p className="text-[11px] text-fg-subtle">
            {filteredPermissions.length} de {totalPermissions} permisos
          </p>
        )}
      </div>

      {error && <p role="alert" className="text-[12px] text-danger">{error}</p>}

      <div className="overflow-x-auto border border-border rounded-sm">
        <table className="min-w-full text-[12px]" role="grid">
          <thead>
            <tr className="bg-surface-muted border-b border-border">
              <th className="text-left px-3 py-2 font-medium text-fg-muted sticky left-0 bg-surface-muted z-10">Permiso</th>
              {matrix.columns.map(col => (
                <th key={col.kind === 'builtin' ? col.role : col.id} className="px-3 py-2 font-medium text-fg-muted text-center min-w-[100px]">
                  <div className="flex flex-col items-center gap-1">
                    <span>{col.kind === 'builtin' ? col.label : col.name}</span>
                    {col.kind === 'custom' && canEdit && (
                      <Button variant="ghost" size="xs" onClick={() => setDeleteRole({ id: col.id, name: col.name })}>
                        Eliminar
                      </Button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([group, perms]) => (
              perms.map((perm, idx) => (
                <tr key={perm.name} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 text-fg sticky left-0 bg-surface z-10">
                    {idx === 0 && (
                      <span className="block text-[10px] uppercase text-fg-subtle mb-0.5">
                        {MODULE_GROUP_LABELS[group] ?? group}
                      </span>
                    )}
                    {perm.label}
                  </td>
                  {matrix.columns.map(col => {
                    const key = col.kind === 'builtin' ? col.role : col.id
                    const checked =
                      col.kind === 'builtin'
                        ? (matrix.grants[col.role]?.includes(perm.name) ?? false)
                        : (draft[col.id]?.has(perm.name) ?? false)
                    const readonly = col.kind === 'builtin' || !canEdit
                    return (
                      <td key={key} className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={readonly}
                          aria-label={`${perm.label} — ${col.kind === 'builtin' ? col.label : col.name}`}
                          onChange={() => {
                            if (col.kind === 'custom') toggleGrant(col.id, perm.name)
                          }}
                          className="h-3.5 w-3.5 accent-brand-600 disabled:opacity-60"
                        />
                      </td>
                    )
                  })}
                </tr>
              ))
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={newRoleOpen} onOpenChange={setNewRoleOpen} title="Nuevo rol custom" size="sm">
        <form onSubmit={handleCreateRole} className="flex flex-col gap-3">
          <Input
            value={newRoleName}
            onChange={e => setNewRoleName(e.target.value)}
            placeholder="Nombre del rol"
            required
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setNewRoleOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              Crear
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deleteRole}
        onOpenChange={open => { if (!open) setDeleteRole(null) }}
        title="Eliminar rol"
        description={deleteRole ? `¿Eliminar el rol «${deleteRole.name}»?` : ''}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => void handleDeleteRole()}
      />
    </div>
  )
}
