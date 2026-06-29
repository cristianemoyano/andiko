'use client'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { ConfirmDialog } from './ConfirmDialog'
import { FilePreviewDialog } from './FilePreviewDialog'
import { formatBytes } from '@/lib/format-bytes'
import { formatLocalDateTime } from '@/lib/date-only'
import {
  getFileDownloadUrl as defaultGetDownloadUrl,
  deleteFile as defaultDeleteFile,
  type FileMetadata,
  type GetDownloadUrlFn,
  type DeleteFileFn,
} from '@/lib/storage-client'

export interface FileViewerProps {
  file: FileMetadata
  /** Show share/delete actions. */
  canManage?: boolean
  /** Render an image thumbnail for image files (fetches a download URL). Default true. */
  showThumbnail?: boolean
  onShare?: (file: FileMetadata) => void
  onDelete?: (file: FileMetadata) => void | Promise<void>
  /** Injectable for tests/Storybook. */
  getDownloadUrl?: GetDownloadUrlFn
  deleteFile?: DeleteFileFn
  className?: string
}

const STATUS_BADGE = {
  pending: { status: 'pending' as const, label: 'Procesando' },
  available: { status: 'success' as const, label: 'Disponible' },
  failed: { status: 'error' as const, label: 'Falló' },
}

export function FileViewer({
  file,
  canManage = false,
  showThumbnail = true,
  onShare,
  onDelete,
  getDownloadUrl = defaultGetDownloadUrl,
  deleteFile = defaultDeleteFile,
  className,
}: FileViewerProps) {
  const [thumb, setThumb] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const available = file.status === 'available'
  const isImage = file.content_type.startsWith('image/')
  const isPdf = file.content_type === 'application/pdf'
  const canPreview = available && (isImage || isPdf)

  useEffect(() => {
    if (!showThumbnail || !isImage || !available) return
    let cancelled = false
    void getDownloadUrl(file.id)
      .then((r) => { if (!cancelled) setThumb(r.url) })
      .catch(() => { /* no thumbnail on error */ })
    return () => { cancelled = true }
  }, [file.id, isImage, available, showThumbnail, getDownloadUrl])

  async function handleDownload() {
    const { url } = await getDownloadUrl(file.id)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function handleConfirmDelete() {
    if (onDelete) await onDelete(file)
    else await deleteFile(file.id)
  }

  const badge = STATUS_BADGE[file.status]

  return (
    <div className={cn('flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2.5', className)}>
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-sm bg-surface-hover">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={file.original_filename} className="h-full w-full object-cover" />
        ) : (
          <FileTypeIcon contentType={file.content_type} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-medium text-fg" title={file.original_filename}>
            {file.original_filename}
          </span>
          <Badge status={badge.status}>{badge.label}</Badge>
        </div>
        <div className="mt-0.5 text-[11px] text-fg-subtle">
          {formatBytes(file.byte_size)} · {formatLocalDateTime(file.uploaded_at ?? file.created_at)}
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-0.5">
        {canPreview && (
          <IconButton label="Ver" onClick={() => setPreviewOpen(true)}>
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </IconButton>
        )}
        <IconButton label="Descargar" onClick={handleDownload} disabled={!available}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="M7 10l5 5 5-5M12 15V3" />
        </IconButton>
        {canManage && (
          <>
            <IconButton label="Compartir" onClick={() => onShare?.(file)}>
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
            </IconButton>
            <IconButton label="Eliminar" variant="danger" onClick={() => setConfirmOpen(true)}>
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </IconButton>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Eliminar archivo"
        description={`El archivo "${file.original_filename}" se eliminará. Esta acción no afecta los documentos vinculados.`}
        onConfirm={handleConfirmDelete}
        confirmLabel="Eliminar archivo"
      />

      <FilePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        file={file}
        getDownloadUrl={getDownloadUrl}
      />
    </div>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  variant = 'ghost',
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  variant?: 'ghost' | 'danger'
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant={variant === 'danger' ? 'ghost' : 'ghost'}
      size="xs"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn('px-1.5', variant === 'danger' && 'text-danger hover:text-danger')}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </Button>
  )
}

/** Inline file-type glyphs keyed by content-type family (no icon library, per design rules). */
function FileTypeIcon({ contentType }: { contentType: string }) {
  const kind = fileKind(contentType)
  const color = {
    pdf: 'text-red-500',
    image: 'text-violet-500',
    sheet: 'text-green-600',
    doc: 'text-blue-500',
    archive: 'text-amber-500',
    generic: 'text-fg-subtle',
  }[kind]

  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={color} aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      {kind === 'image' && <circle cx="10" cy="13" r="1.5" />}
      {kind === 'image' && <path d="m8 19 3-3 2 2 2-2 1.5 1.5" />}
      {kind === 'sheet' && <path d="M8 13h8M8 17h8M10 13v4M14 13v4" />}
      {(kind === 'doc' || kind === 'pdf') && <path d="M8 13h8M8 17h5" />}
      {kind === 'archive' && <path d="M12 11v2m0 2v2" />}
    </svg>
  )
}

function fileKind(contentType: string): 'pdf' | 'image' | 'sheet' | 'doc' | 'archive' | 'generic' {
  if (contentType === 'application/pdf') return 'pdf'
  if (contentType.startsWith('image/')) return 'image'
  if (contentType.includes('spreadsheet') || contentType.includes('excel') || contentType === 'text/csv') return 'sheet'
  if (contentType.includes('word') || contentType === 'text/plain') return 'doc'
  if (contentType.includes('zip')) return 'archive'
  return 'generic'
}
