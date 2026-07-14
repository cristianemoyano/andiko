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
import { permissionDisplayLabel, sortPermissionsForGroup } from '@/lib/permission-labels'
import { useCapabilities } from '@/components/layout/CapabilitiesContext'

type MatrixColumn =
  | { kind: 'builtin'; role: UserRole; label: string; readonly: true }
  | { kind: 'custom'; id: string; name: string; allows_pos: boolean; user_count: number; readonly: false }

interface MatrixPayload {
  permissions: Array<{ name: MatrixPermission; label: string; description: string; group: string }>
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
  logistics: 'Logística',
  expenses: 'Expensas',
}

const DEFAULT_ROLE_FILTER_KEY = 'admin'

const MODULE_GROUP_ORDER = [
  'panel',
  'contacts',
  'products',
  'sales',
  'inventory',
  'purchases',
  'accounting',
  'logistics',
  'expenses',
] as const

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

function columnKey(col: MatrixColumn): string {
  return col.kind === 'builtin' ? col.role : col.id
}

function columnLabel(col: MatrixColumn): string {
  return col.kind === 'builtin' ? col.label : col.name
}

function roleHasPermission(
  col: MatrixColumn,
  permission: MatrixPermission,
  grants: Record<string, MatrixPermission[]>,
  draft: Record<string, Set<MatrixPermission>>,
): boolean {
  if (col.kind === 'builtin') {
    return grants[col.role]?.includes(permission) ?? false
  }
  return draft[col.id]?.has(permission) ?? false
}

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
  const [roleFilterKey, setRoleFilterKey] = useState<string | null>(DEFAULT_ROLE_FILTER_KEY)

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

  const roleFilteredColumn = useMemo(
    () => matrix?.columns.find(col => columnKey(col) === roleFilterKey) ?? null,
    [matrix, roleFilterKey],
  )

  const assignedPermissionCount = useMemo(() => {
    if (!matrix || !roleFilteredColumn) return 0
    return filteredPermissions.filter(perm =>
      roleHasPermission(roleFilteredColumn, perm.name, matrix.grants, draft),
    ).length
  }, [matrix, roleFilteredColumn, filteredPermissions, draft])

  const visibleColumns = useMemo(() => {
    if (!matrix) return []
    if (roleFilteredColumn) return [roleFilteredColumn]
    return matrix.columns
  }, [matrix, roleFilteredColumn])

  const grouped = useMemo(
    () => filteredPermissions.reduce<Record<string, typeof filteredPermissions>>((acc, p) => {
      acc[p.group] = acc[p.group] ?? []
      acc[p.group].push(p)
      return acc
    }, {}),
    [filteredPermissions],
  )

  const sortedGrouped = useMemo(
    () => Object.fromEntries(
      Object.entries(grouped).map(([group, perms]) => [group, sortPermissionsForGroup(group, perms)]),
    ),
    [grouped],
  )

  const moduleFilterActive = activeModuleFilter !== null
  const roleFilterActive = roleFilterKey !== null
  const totalPermissions = matrix?.permissions.length ?? 0
  const scopedPermissionCount = filteredPermissions.length
  const unassignedPermissionCount = roleFilterActive
    ? scopedPermissionCount - assignedPermissionCount
    : 0

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
      if (roleFilterKey === deleteRole.id) setRoleFilterKey(DEFAULT_ROLE_FILTER_KEY)
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

  function selectRoleFilter(key: string) {
    setRoleFilterKey(prev => (prev === key ? null : key))
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
        <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">Módulo</p>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {moduleGroups.map(group => (
            <button
              key={group}
              type="button"
              onClick={() => selectModuleGroup(group)}
              className={`shrink-0 snap-start rounded-sm border px-2 py-0.5 text-[11px] transition-colors ${
                !showAllModules && activeModuleFilter === group
                  ? 'border-brand-accent bg-brand-accent-bg text-brand-accent'
                  : 'border-border bg-surface text-fg-muted hover:bg-surface-muted'
              }`}
            >
              {MODULE_GROUP_LABELS[group] ?? group}
            </button>
          ))}
          <button
            type="button"
            onClick={clearModuleFilter}
            className={`shrink-0 snap-start rounded-sm border px-2 py-0.5 text-[11px] transition-colors ${
              showAllModules
                ? 'border-brand-accent bg-brand-accent-bg text-brand-accent'
                : 'border-border bg-surface text-fg-muted hover:bg-surface-muted'
            }`}
          >
            Todos
          </button>
          {moduleFilterActive && (
            <button
              type="button"
              onClick={clearModuleFilter}
              className="shrink-0 snap-start text-[11px] text-fg-muted underline-offset-2 hover:underline"
            >
              Ver todos
            </button>
          )}
        </div>
        {moduleFilterActive && !roleFilterActive && (
          <p className="text-[11px] text-fg-subtle">
            {filteredPermissions.length} de {totalPermissions} permisos
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">Rol</p>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {matrix.columns.map(col => {
            const key = columnKey(col)
            return (
              <button
                key={key}
                type="button"
                onClick={() => selectRoleFilter(key)}
                className={`shrink-0 snap-start rounded-sm border px-2 py-0.5 text-[11px] transition-colors ${
                  roleFilterKey === key
                    ? 'border-brand-accent bg-brand-accent-bg text-brand-accent'
                    : 'border-border bg-surface text-fg-muted hover:bg-surface-muted'
                }`}
              >
                {columnLabel(col)}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setRoleFilterKey(null)}
            className={`shrink-0 snap-start rounded-sm border px-2 py-0.5 text-[11px] transition-colors ${
              !roleFilterActive
                ? 'border-brand-accent bg-brand-accent-bg text-brand-accent'
                : 'border-border bg-surface text-fg-muted hover:bg-surface-muted'
            }`}
          >
            Todos
          </button>
        </div>
        {roleFilterActive && roleFilteredColumn && (
          <p className="text-[11px] text-fg-subtle">
            {assignedPermissionCount} de {scopedPermissionCount} permiso
            {scopedPermissionCount === 1 ? '' : 's'} asignado
            {assignedPermissionCount === 1 ? '' : 's'} a {columnLabel(roleFilteredColumn)}
            {moduleFilterActive && activeModuleFilter
              ? ` en ${MODULE_GROUP_LABELS[activeModuleFilter] ?? activeModuleFilter}`
              : ''}
            {unassignedPermissionCount > 0 && (
              <span className="text-fg-muted">
                {' '}· {unassignedPermissionCount} sin asignar
              </span>
            )}
          </p>
        )}
        {roleFilterActive && roleFilteredColumn && canEdit && roleFilteredColumn.kind === 'custom' && unassignedPermissionCount > 0 && (
          <p className="text-[11px] text-fg-muted">
            Marcá los permisos que falten para actualizar este rol.
          </p>
        )}
      </div>

      {error && <p role="alert" className="text-[12px] text-danger">{error}</p>}

      <div className="overflow-x-auto rounded-md shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.18)]">
        <table className="min-w-full text-[12px]" role="grid">
          <thead>
            <tr className="bg-surface-muted border-b border-border">
              <th className="text-left px-3 py-2 font-medium text-fg-muted sticky left-0 bg-surface-muted z-10">Permiso</th>
              {visibleColumns.map(col => (
                <th key={columnKey(col)} className="px-3 py-2 font-medium text-fg-muted text-center min-w-[100px]">
                  <div className="flex flex-col items-center gap-1">
                    <span>{columnLabel(col)}</span>
                    {col.kind === 'custom' && canEdit && !roleFilterActive && (
                      col.user_count > 0 ? (
                        <span
                          className="text-[10px] text-fg-subtle tabular-nums"
                          title={`${col.user_count} usuario${col.user_count === 1 ? '' : 's'} asignado${col.user_count === 1 ? '' : 's'}. Reasigná antes de eliminar.`}
                        >
                          {col.user_count} usr.
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteRole({ id: col.id, name: col.name })}
                          className="p-0.5 text-danger/70 hover:text-danger transition-colors"
                          aria-label={`Eliminar rol ${col.name}`}
                        >
                          <TrashIcon />
                        </button>
                      )
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scopedPermissionCount === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length + 1}
                  className="px-3 py-6 text-center text-fg-muted"
                >
                  No hay permisos para mostrar.
                </td>
              </tr>
            ) : (
              Object.entries(sortedGrouped).map(([group, perms]) => (
                perms.map((perm, idx) => {
                  const assignedInRoleView = roleFilteredColumn
                    ? roleHasPermission(roleFilteredColumn, perm.name, matrix.grants, draft)
                    : true
                  return (
                  <tr
                    key={perm.name}
                    className={`border-b border-border last:border-0 ${
                      roleFilterActive && !assignedInRoleView ? 'bg-surface-muted/40' : ''
                    }`}
                  >
                    <td className={`px-3 py-2 sticky left-0 z-10 ${
                      roleFilterActive && !assignedInRoleView
                        ? 'text-fg-muted bg-surface-muted/40'
                        : 'text-fg bg-surface'
                    }`}>
                      {idx === 0 && (
                        <span className="block text-[10px] uppercase text-fg-subtle mb-0.5">
                          {MODULE_GROUP_LABELS[group] ?? group}
                        </span>
                      )}
                      {permissionDisplayLabel(perm.name)}
                      {perm.description ? (
                        <span className="block text-[10px] text-fg-subtle font-normal mt-0.5 max-w-md leading-snug">
                          {perm.description}
                        </span>
                      ) : null}
                    </td>
                    {visibleColumns.map(col => {
                      const key = columnKey(col)
                      const checked = roleHasPermission(col, perm.name, matrix.grants, draft)
                      const readonly = col.kind === 'builtin' || !canEdit
                      const builtinPanelGrant =
                        col.kind === 'builtin' &&
                        perm.name === 'panel:read' &&
                        (col.role === 'admin' || col.role === 'branch-admin')
                      return (
                        <td key={key} className={`px-3 py-2 text-center ${
                          roleFilterActive && !checked ? 'bg-surface-muted/40' : ''
                        }`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={readonly}
                            title={
                              builtinPanelGrant
                                ? 'Siempre incluido para Gerente y Encargado de sucursal'
                                : undefined
                            }
                            aria-label={`${permissionDisplayLabel(perm.name)} — ${columnLabel(col)}`}
                            onChange={() => {
                              if (col.kind === 'custom') toggleGrant(col.id, perm.name)
                            }}
                            className="h-3.5 w-3.5 accent-brand-600 disabled:opacity-60"
                          />
                        </td>
                      )
                    })}
                  </tr>
                  )
                })
              ))
            )}
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
