'use client'
import { useRef, useState, useId } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/primitives/Button'
import { formatBytes } from '@/lib/format-bytes'
import {
  uploadFile as defaultUploadFile,
  DEFAULT_ALLOWED_CONTENT_TYPES,
  type UploadFileFn,
  type OwnerLink,
  type FileMetadata,
} from '@/lib/storage-client'

const DEFAULT_MAX_BYTES = 26_214_400 // 25 MiB — mirrors FILE_MAX_BYTES default

type ItemStatus = 'uploading' | 'done' | 'error'
interface UploadItem {
  id: string
  name: string
  size: number
  status: ItemStatus
  error?: string
}

export interface FileUploaderProps {
  /** Owner records to attach the uploaded file(s) to (drives inherited access). */
  links?: OwnerLink[]
  /** Accepted content types. Defaults to the server allow-list. */
  accept?: readonly string[]
  /** Max bytes per file (client-side pre-check). Defaults to 25 MiB. */
  maxBytes?: number
  multiple?: boolean
  disabled?: boolean
  onUploaded?: (file: FileMetadata) => void
  /** Injectable for tests/Storybook; defaults to the real presigned 3-step upload. */
  uploadFile?: UploadFileFn
  className?: string
}

export function FileUploader({
  links,
  accept = DEFAULT_ALLOWED_CONTENT_TYPES,
  maxBytes = DEFAULT_MAX_BYTES,
  multiple = false,
  disabled = false,
  onUploaded,
  uploadFile = defaultUploadFile,
  className,
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const [dragOver, setDragOver] = useState(false)
  const [items, setItems] = useState<UploadItem[]>([])

  function validate(file: File): string | null {
    if (accept.length > 0 && !accept.includes(file.type)) return 'Tipo de archivo no permitido'
    if (file.size > maxBytes) return `Supera el máximo de ${formatBytes(maxBytes)}`
    return null
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || disabled) return
    const files = Array.from(fileList)
    for (const file of files) {
      const id = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const error = validate(file)
      if (error) {
        setItems((prev) => [...prev, { id, name: file.name, size: file.size, status: 'error', error }])
        continue
      }
      setItems((prev) => [...prev, { id, name: file.name, size: file.size, status: 'uploading' }])
      try {
        const uploaded = await uploadFile(file, { links })
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: 'done' } : it)))
        onUploaded?.(uploaded)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al subir el archivo'
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: 'error', error: message } : it)))
      }
    }
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (disabled) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          if (disabled) return
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          void handleFiles(e.dataTransfer.files)
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-md border border-dashed px-6 py-8 text-center transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          disabled
            ? 'cursor-not-allowed border-border bg-surface-hover text-fg-subtle'
            : 'cursor-pointer border-border-strong bg-surface hover:bg-surface-hover',
          dragOver && !disabled && 'border-ring bg-brand-50',
        )}
      >
        <UploadIcon className={cn('text-fg-subtle', dragOver && !disabled && 'text-brand-600')} />
        <div className="text-[13px] text-fg-muted">
          Arrastrá un archivo o{' '}
          <span className="font-medium text-brand-700">hacé clic para elegir</span>
        </div>
        <div className="text-[11px] text-fg-subtle">Hasta {formatBytes(maxBytes)}</div>
        <Button type="button" variant="secondary" size="xs" disabled={disabled} tabIndex={-1} className="mt-1">
          Elegir archivo
        </Button>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="hidden"
          accept={accept.join(',')}
          multiple={multiple}
          disabled={disabled}
          onChange={(e) => {
            void handleFiles(e.target.files)
            e.target.value = '' // allow re-selecting the same file
          }}
        />
      </div>

      {items.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2.5 rounded-sm border border-border bg-surface px-3 py-2"
            >
              <FileGlyph className="flex-shrink-0 text-fg-subtle" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] text-fg">{item.name}</div>
                <div className="text-[11px] text-fg-subtle">
                  {item.status === 'error' ? (
                    <span role="alert" className="text-danger">{item.error}</span>
                  ) : (
                    formatBytes(item.size)
                  )}
                </div>
              </div>
              <StatusGlyph status={item.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function StatusGlyph({ status }: { status: ItemStatus }) {
  if (status === 'uploading') {
    return (
      <span className="flex items-center gap-1.5 text-[11px] text-fg-muted">
        <Spinner />
        Subiendo…
      </span>
    )
  }
  if (status === 'done') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-success" aria-label="Subido">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    )
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-danger" aria-label="Error">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin text-fg-subtle" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8l-5-5-5 5M12 3v12" />
    </svg>
  )
}

function FileGlyph({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  )
}
