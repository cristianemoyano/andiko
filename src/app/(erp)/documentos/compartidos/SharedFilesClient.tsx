'use client'

import { useEffect, useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { FileViewer } from '@/components/erp/FileViewer'
import { FileSharing } from '@/components/erp/FileSharing'
import { Badge } from '@/components/primitives/Badge'
import { getApiErrorMessage } from '@/lib/fetch-json'
import { formatLocalDateTime } from '@/lib/date-only'
import {
  FILE_OWNER_TYPE_LABELS,
  listSharedWithMeFiles as defaultListShared,
  type SharedFileListItem,
  type ListSharedWithMeFn,
  type FileMetadata,
} from '@/lib/storage-client'

const PERMISSION_LABELS = { read: 'Lectura', write: 'Escritura' } as const

function ownerContext(links: SharedFileListItem['owner_links']): string | null {
  if (links.length === 0) return null
  const labels = [...new Set(links.map((l) => FILE_OWNER_TYPE_LABELS[l.owner_type]))]
  return labels.join(' · ')
}

export interface SharedFilesClientProps {
  listShared?: ListSharedWithMeFn
}

export function SharedFilesClient({ listShared = defaultListShared }: SharedFilesClientProps) {
  const [items, setItems] = useState<SharedFileListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [shareTarget, setShareTarget] = useState<FileMetadata | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const res = await listShared({ limit: 50 })
        if (!cancelled) setItems(res.data)
      } catch (err) {
        if (!cancelled) setLoadError(getApiErrorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refresh, listShared])

  return (
    <>
      <TopBar breadcrumbs={[{ label: 'Compartidos con vos' }]} />
      <PageBody>
        <p className="text-[13px] text-fg-muted mb-4 max-w-2xl">
          Archivos que alguien compartió con vos directamente. Podés verlos y descargarlos aunque no
          tengas acceso al módulo donde están vinculados.
        </p>

        {loading ? (
          <p className="text-[13px] text-fg-muted">Cargando…</p>
        ) : loadError ? (
          <p className="text-[13px] text-danger" role="alert">{loadError}</p>
        ) : items.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border-strong px-4 py-10 text-center">
            <p className="text-[13px] text-fg-subtle">Nadie compartió archivos con vos todavía.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3 max-w-3xl">
            {items.map((item) => {
              const context = ownerContext(item.owner_links)
              const canManage = item.share_permission === 'write'
              return (
                <li key={item.id} className="rounded-md border border-border bg-surface p-3">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge status="info">{PERMISSION_LABELS[item.share_permission]}</Badge>
                    <span className="text-[11px] text-fg-subtle">
                      Compartido {formatLocalDateTime(item.shared_at)}
                    </span>
                    {context && (
                      <span className="text-[11px] text-fg-muted">· {context}</span>
                    )}
                  </div>
                  <FileViewer
                    file={item}
                    canManage={canManage}
                    onShare={canManage ? () => setShareTarget(item) : undefined}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </PageBody>

      {shareTarget && (
        <FileSharing
          open
          onOpenChange={(open) => {
            if (!open) {
              setShareTarget(null)
              setRefresh((r) => r + 1)
            }
          }}
          fileId={shareTarget.id}
          fileName={shareTarget.original_filename}
          canManage
        />
      )}
    </>
  )
}
