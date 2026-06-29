'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import {
  getFileContentUrl,
  getFileDownloadUrl as defaultGetDownloadUrl,
  type FileMetadata,
  type GetDownloadUrlFn,
} from '@/lib/storage-client'

export interface FilePreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  file: FileMetadata
  /** Override preview URL (Storybook). Skips fetch + blob URL. */
  previewUrl?: string
  getDownloadUrl?: GetDownloadUrlFn
}

/**
 * In-app preview for PDFs and images.
 * Fetches bytes from `/api/v1/files/{id}/content` and renders via a blob URL so Dropbox's
 * `application/octet-stream` and `Content-Disposition: attachment` never force a download.
 */
export function FilePreviewDialog({
  open,
  onOpenChange,
  file,
  previewUrl,
  getDownloadUrl = defaultGetDownloadUrl,
}: FilePreviewDialogProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  const isPdf = file.content_type === 'application/pdf'
  const isImage = file.content_type.startsWith('image/')
  const canPreview = file.status === 'available' && (isPdf || isImage)
  const contentUrl = previewUrl ?? getFileContentUrl(file.id)
  const renderUrl = previewUrl ?? blobUrl

  useEffect(() => {
    if (!open || !canPreview || previewUrl) {
      return () => {
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current)
          blobUrlRef.current = null
        }
      }
    }

    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(contentUrl, { credentials: 'same-origin' })
        if (!res.ok) {
          throw new Error(`No se pudo cargar el archivo (HTTP ${res.status})`)
        }
        const buffer = await res.arrayBuffer()
        const type = file.content_type || res.headers.get('content-type') || 'application/octet-stream'
        const url = URL.createObjectURL(new Blob([buffer], { type }))
        blobUrlRef.current = url
        if (!cancelled) setBlobUrl(url)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar la vista previa')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
      setBlobUrl(null)
    }
  }, [open, canPreview, contentUrl, file.content_type, previewUrl])

  async function handleDownload() {
    const { url: downloadUrl } = await getDownloadUrl(file.id)
    window.open(downloadUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={file.original_filename}
      description="Vista previa del archivo"
      size="lg"
    >
      <div className="flex min-h-[420px] flex-col">
        {file.status !== 'available' ? (
          <p className="text-[13px] text-fg-muted">El archivo aún no está disponible para previsualizar.</p>
        ) : !canPreview ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <p className="text-[13px] text-fg-muted">No hay vista previa para este tipo de archivo.</p>
            <Button type="button" size="sm" onClick={() => void handleDownload()}>
              Descargar
            </Button>
          </div>
        ) : (
          <>
            {loading && !error && (
              <p className="text-[13px] text-fg-muted">Cargando vista previa…</p>
            )}
            {error && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <p role="alert" className="text-[13px] text-danger">{error}</p>
                <Button type="button" size="sm" onClick={() => void handleDownload()}>
                  Descargar
                </Button>
              </div>
            )}
            {isPdf && renderUrl && !loading && !error && (
              <iframe
                title={file.original_filename}
                src={renderUrl}
                className="h-[min(70vh,640px)] w-full rounded-sm border border-border bg-white"
              />
            )}
            {isImage && renderUrl && !loading && !error && (
              <div className="flex flex-1 items-center justify-center overflow-auto rounded-sm border border-border bg-surface-muted p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={renderUrl}
                  alt={file.original_filename}
                  className="max-h-[min(70vh,640px)] max-w-full object-contain"
                />
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  )
}
