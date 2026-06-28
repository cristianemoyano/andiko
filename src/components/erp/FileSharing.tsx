'use client'
import { useEffect, useState } from 'react'
import { Dialog } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { Select } from '@/components/primitives/Select'
import { Input } from '@/components/primitives/Input'
import { FormField } from '@/components/primitives/FormField'
import { Badge } from '@/components/primitives/Badge'
import { ConfirmDialog } from './ConfirmDialog'
import { getApiErrorMessage } from '@/lib/fetch-json'
import {
  listFileShares as defaultListShares,
  addFileShare as defaultAddShare,
  revokeFileShare as defaultRevokeShare,
  type FileShare,
  type SharePrincipalType,
  type SharePermission,
  type ListSharesFn,
  type AddShareFn,
  type RevokeShareFn,
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
}

const PRINCIPAL_LABELS: Record<SharePrincipalType, string> = {
  user: 'Usuario',
  org_role: 'Rol',
  branch: 'Sucursal',
}
const PERMISSION_LABELS: Record<SharePermission, string> = { read: 'Lectura', write: 'Escritura' }

export function FileSharing({
  open,
  onOpenChange,
  fileId,
  fileName,
  canManage = false,
  listShares = defaultListShares,
  addShare = defaultAddShare,
  revokeShare = defaultRevokeShare,
}: FileSharingProps) {
  const [shares, setShares] = useState<FileShare[]>([])
  const [loading, setLoading] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Add-share form state
  const [principalType, setPrincipalType] = useState<SharePrincipalType>('user')
  const [principalId, setPrincipalId] = useState('')
  const [permission, setPermission] = useState<SharePermission>('read')
  const [saving, setSaving] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const [revokeTarget, setRevokeTarget] = useState<FileShare | null>(null)

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

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFieldError(null)
    setServerError(null)
    if (!principalId.trim()) {
      setFieldError('Indicá el ID del usuario, rol o sucursal')
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
                    <div className="truncate text-[11px] text-fg-subtle" title={share.principal_id}>
                      {share.principal_id}
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
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Tipo" htmlFor="principal_type">
                <Select
                  id="principal_type"
                  value={principalType}
                  onChange={(v) => setPrincipalType(v as SharePrincipalType)}
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
            <FormField label="ID (usuario / rol / sucursal)" htmlFor="principal_id" error={fieldError ?? undefined}>
              <Input
                id="principal_id"
                value={principalId}
                onChange={(e) => setPrincipalId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                error={!!fieldError}
              />
            </FormField>
            {serverError && (
              <p role="alert" className="rounded-sm border border-danger bg-danger-bg px-3 py-2 text-[12px] text-danger">
                {serverError}
              </p>
            )}
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={saving}>
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
        description={revokeTarget ? `Se quitará el acceso de ${PRINCIPAL_LABELS[revokeTarget.principal_type]} ${revokeTarget.principal_id}.` : ''}
        onConfirm={handleRevoke}
        confirmLabel="Quitar acceso"
      />
    </Dialog>
  )
}
