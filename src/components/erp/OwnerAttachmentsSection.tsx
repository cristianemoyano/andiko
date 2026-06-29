'use client'

import { useEffect, useMemo, useState } from 'react'
import { FileUploader } from './FileUploader'
import { FileViewer } from './FileViewer'
import { FileSharing } from './FileSharing'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifyApiError, notifySuccess } from '@/lib/notify'
import {
  deleteFile,
  type FileMetadata,
  type FileOwnerType,
  type OwnerLink,
} from '@/lib/storage-client'

export interface OwnerAttachmentsSectionProps {
  ownerType: FileOwnerType
  ownerId: string
  /** Show upload, share, and delete actions. Defaults to true. */
  canManage?: boolean
  title?: string
}

type FilesListResponse = {
  data: FileMetadata[]
  total: number
}

export function OwnerAttachmentsSection({
  ownerType,
  ownerId,
  canManage = true,
  title = 'Archivos adjuntos',
}: OwnerAttachmentsSectionProps) {
  const [files, setFiles] = useState<FileMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [shareTarget, setShareTarget] = useState<FileMetadata | null>(null)

  const links = useMemo<OwnerLink[]>(
    () => [{ owner_type: ownerType, owner_id: ownerId }],
    [ownerType, ownerId],
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const params = new URLSearchParams({
          owner_type: ownerType,
          owner_id: ownerId,
          limit: '50',
        })
        const res = await fetchJson<FilesListResponse>(`/api/v1/files?${params}`)
        if (!cancelled) setFiles(res.data)
      } catch (err) {
        if (!cancelled) setLoadError(getApiErrorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ownerType, ownerId, refresh])

  async function handleDelete(file: FileMetadata) {
    try {
      await deleteFile(file.id)
      notifySuccess('Archivo eliminado')
      setRefresh(r => r + 1)
    } catch (err) {
      notifyApiError(err)
    }
  }

  return (
    <div className="bg-surface border border-border rounded overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border bg-surface-muted">
        <span className="text-[11px] font-semibold text-fg-muted uppercase tracking-wide">{title}</span>
      </div>

      <div className="p-4 space-y-4">
        {canManage && (
          <FileUploader
            links={links}
            onUploaded={() => setRefresh(r => r + 1)}
          />
        )}

        {loading ? (
          <p className="text-[13px] text-fg-muted">Cargando archivos…</p>
        ) : loadError ? (
          <p className="text-[13px] text-danger" role="alert">{loadError}</p>
        ) : files.length === 0 ? (
          <p className="text-[13px] text-fg-subtle">Sin archivos adjuntos.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {files.map(file => (
              <li key={file.id}>
                <FileViewer
                  file={file}
                  canManage={canManage}
                  onShare={canManage ? f => setShareTarget(f) : undefined}
                  onDelete={canManage ? handleDelete : undefined}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {shareTarget && (
        <FileSharing
          open
          onOpenChange={open => { if (!open) setShareTarget(null) }}
          fileId={shareTarget.id}
          fileName={shareTarget.original_filename}
          canManage={canManage}
        />
      )}
    </div>
  )
}
