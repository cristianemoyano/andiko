'use client'
import { useEffect, useMemo, useState } from 'react'
import { Dialog } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { Select } from '@/components/primitives/Select'
import { FormField } from '@/components/primitives/FormField'
import { Badge } from '@/components/primitives/Badge'
import { ConfirmDialog } from './ConfirmDialog'
import { getApiErrorMessage } from '@/lib/fetch-json'
import {
  listFileShares as defaultListShares,
  addFileShare as defaultAddShare,
  revokeFileShare as defaultRevokeShare,
  fetchSharePrincipals as defaultFetchPrincipals,
  type FileShare,
  type SharePrincipalType,
  type SharePermission,
  type SharePrincipalOptions,
  type ListSharesFn,
  type AddShareFn,
  type RevokeShareFn,
  type FetchSharePrincipalsFn,
} from '@/lib/storage-client'

export interface FileSharingProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fileId: string
  fileName?: string
  /** Show the add-share form and revoke actions. */
  canManage?: boolean
  /** Injectable for tests/Storybook. */
  listShares?: ListSharesFn
  addShare?: AddShareFn
  revokeShare?: RevokeShareFn
  fetchPrincipals?: FetchSharePrincipalsFn
}

const PRINCIPAL_LABELS: Record<SharePrincipalType, string> = {
  user: 'Usuario',
  org_role: 'Rol',
  branch: 'Sucursal',
}
const PRINCIPAL_FIELD_LABELS: Record<SharePrincipalType, string> = {
  user: 'Usuario',
  org_role: 'Rol',
  branch: 'Sucursal',
}
const PERMISSION_LABELS: Record<SharePermission, string> = { read: 'Lectura', write: 'Escritura' }

function principalOptionsForType(
  principals: SharePrincipalOptions | null,
  type: SharePrincipalType,
) {
  if (!principals) return []
  switch (type) {
    case 'user':
      return principals.users
    case 'org_role':
      return principals.org_roles
    case 'branch':
      return principals.branches
  }
}

function buildLabelMap(principals: SharePrincipalOptions | null): Map<string, string> {
  const map = new Map<string, string>()
  if (!principals) return map
  for (const u of principals.users) map.set(`user:${u.id}`, u.label)
  for (const r of principals.org_roles) map.set(`org_role:${r.id}`, r.label)
  for (const b of principals.branches) map.set(`branch:${b.id}`, b.label)
  return map
}

export function FileSharing({
  open,
  onOpenChange,
  fileId,
  fileName,
  canManage = false,
  listShares = defaultListShares,
  addShare = defaultAddShare,
  revokeShare = defaultRevokeShare,
  fetchPrincipals = defaultFetchPrincipals,
}: FileSharingProps) {
  const [shares, setShares] = useState<FileShare[]>([])
  const [loading, setLoading] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [principals, setPrincipals] = useState<SharePrincipalOptions | null>(null)
  const [principalsLoading, setPrincipalsLoading] = useState(false)
  const [principalsError, setPrincipalsError] = useState<string | null>(null)

  // Add-share form state
  const [principalType, setPrincipalType] = useState<SharePrincipalType>('user')
  const [principalId, setPrincipalId] = useState('')
  const [permission, setPermission] = useState<SharePermission>('read')
  const [saving, setSaving] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const [revokeTarget, setRevokeTarget] = useState<FileShare | null>(null)

  const labelMap = useMemo(() => buildLabelMap(principals), [principals])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      if (!cancelled) { setLoading(true); setLoadError(null) }
      try {
        const data = await listShares(fileId)
        if (!cancelled) setShares(data)
      } catch (err) {
        if (!cancelled) setLoadError(getApiErrorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [open, fileId, refresh, listShares])

  useEffect(() => {
    if (!open || !canManage) return
    let cancelled = false
    void (async () => {
      if (!cancelled) { setPrincipalsLoading(true); setPrincipalsError(null) }
      try {
        const data = await fetchPrincipals()
        if (!cancelled) setPrincipals(data)
      } catch (err) {
        if (!cancelled) setPrincipalsError(getApiErrorMessage(err))
      } finally {
        if (!cancelled) setPrincipalsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [open, canManage, fetchPrincipals])

  const selectableOptions = useMemo(() => {
    const all = principalOptionsForType(principals, principalType)
    const taken = new Set(
      shares.filter((s) => s.principal_type === principalType).map((s) => s.principal_id),
    )
    return all.filter((o) => !taken.has(o.id))
  }, [principals, principalType, shares])

  function resolveShareLabel(share: FileShare): string {
    return labelMap.get(`${share.principal_type}:${share.principal_id}`) ?? share.principal_id
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFieldError(null)
    setServerError(null)
    if (!principalId.trim()) {
      setFieldError(`Seleccioná ${PRINCIPAL_FIELD_LABELS[principalType].toLowerCase()}`)
      return
    }
    setSaving(true)
    try {
      await addShare(fileId, { principal_type: principalType, principal_id: principalId.trim(), permission })
      setPrincipalId('')
      setPermission('read')
      setRefresh((r) => r + 1)
    } catch (err) {
      setServerError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleRevoke() {
    if (!revokeTarget) return
    await revokeFileShareSafely(revokeTarget.id)
  }

  async function revokeFileShareSafely(shareId: string) {
    await revokeShare(fileId, shareId)
    setRefresh((r) => r + 1)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Compartir archivo"
      description={fileName ? `Acceso a "${fileName}"` : 'Gestioná quién puede ver este archivo'}
      size="md"
    >
      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-2">
          <h3 className="text-[12px] font-medium text-fg-muted">Accesos directos</h3>
          {loading ? (
            <p className="text-[13px] text-fg-subtle">Cargando…</p>
          ) : loadError ? (
            <p role="alert" className="text-[12px] text-danger">{loadError}</p>
          ) : shares.length === 0 ? (
            <p className="rounded-sm border border-dashed border-border-strong px-3 py-4 text-center text-[12px] text-fg-subtle">
              Sin accesos directos. El acceso se hereda de los registros vinculados.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {shares.map((share) => (
                <li key={share.id} className="flex items-center gap-2.5 rounded-sm border border-border bg-surface px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] text-fg">{PRINCIPAL_LABELS[share.principal_type]}</span>
                      <Badge status="info">{PERMISSION_LABELS[share.permission]}</Badge>
                    </div>
                    <div className="truncate text-[11px] text-fg-subtle" title={resolveShareLabel(share)}>
                      {resolveShareLabel(share)}
                      {share.expires_at ? ` · vence ${share.expires_at.slice(0, 10)}` : ''}
                    </div>
                  </div>
                  {canManage && (
                    <Button type="button" variant="ghost" size="xs" className="text-danger hover:text-danger" onClick={() => setRevokeTarget(share)}>
                      Quitar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {canManage && (
          <form onSubmit={handleAdd} className="flex flex-col gap-3 border-t border-border pt-4">
            <h3 className="text-[12px] font-medium text-fg-muted">Agregar acceso</h3>
            {principalsError && (
              <p role="alert" className="text-[12px] text-danger">{principalsError}</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Tipo" htmlFor="principal_type">
                <Select
                  id="principal_type"
                  value={principalType}
                  onChange={(v) => {
                    setPrincipalType(v as SharePrincipalType)
                    setPrincipalId('')
                    setFieldError(null)
                  }}
                  options={[
                    { value: 'user', label: 'Usuario' },
                    { value: 'org_role', label: 'Rol' },
                    { value: 'branch', label: 'Sucursal' },
                  ]}
                />
              </FormField>
              <FormField label="Permiso" htmlFor="permission">
                <Select
                  id="permission"
                  value={permission}
                  onChange={(v) => setPermission(v as SharePermission)}
                  options={[
                    { value: 'read', label: 'Lectura' },
                    { value: 'write', label: 'Escritura' },
                  ]}
                />
              </FormField>
            </div>
            <FormField
              label={PRINCIPAL_FIELD_LABELS[principalType]}
              htmlFor="principal_id"
              error={fieldError ?? undefined}
            >
              <Select
                id="principal_id"
                value={principalId || null}
                onChange={setPrincipalId}
                placeholder={
                  principalsLoading
                    ? 'Cargando…'
                    : selectableOptions.length === 0
                      ? 'Sin opciones disponibles'
                      : `Seleccionar ${PRINCIPAL_FIELD_LABELS[principalType].toLowerCase()}…`
                }
                options={selectableOptions.map((o) => ({ value: o.id, label: o.label }))}
                disabled={principalsLoading || selectableOptions.length === 0}
                error={!!fieldError}
              />
            </FormField>
            {serverError && (
              <p role="alert" className="rounded-sm border border-danger bg-danger-bg px-3 py-2 text-[12px] text-danger">
                {serverError}
              </p>
            )}
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={saving || principalsLoading}>
                {saving ? 'Agregando…' : 'Agregar acceso'}
              </Button>
            </div>
          </form>
        )}
      </div>

      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(o) => { if (!o) setRevokeTarget(null) }}
        title="Quitar acceso"
        description={
          revokeTarget
            ? `Se quitará el acceso de ${PRINCIPAL_LABELS[revokeTarget.principal_type]} ${resolveShareLabel(revokeTarget)}.`
            : ''
        }
        onConfirm={handleRevoke}
        confirmLabel="Quitar acceso"
      />
    </Dialog>
  )
}
