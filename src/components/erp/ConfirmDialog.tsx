'use client'
import { useState } from 'react'
import { Dialog } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { cn } from '@/lib/utils'

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  onConfirm: () => void | Promise<void>
  variant?: 'danger' | 'warning'
  confirmLabel?: string
  cancelLabel?: string
  className?: string
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  variant = 'danger',
  confirmLabel,
  cancelLabel = 'Cancelar',
  className,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false)

  const defaultConfirmLabel = variant === 'danger' ? 'Eliminar' : 'Confirmar'

  async function handleConfirm() {
    setLoading(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="sm"
      hideClose
      className={className}
      contentTestId="confirm-dialog"
    >
      <div className="flex flex-col gap-4">
        <div className={cn('flex gap-3')}>
          <div className={cn(
            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full',
            variant === 'danger' ? 'bg-danger-bg' : 'bg-warning-bg',
          )}>
            {variant === 'danger' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-danger">
                <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4M12 17h.01" />
              </svg>
            )}
          </div>
          <p className="text-[13px] text-fg-muted leading-relaxed pt-1.5">{description}</p>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            data-testid="confirm-dialog-cancel-btn"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="sm"
            data-testid="confirm-dialog-btn"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Procesando…' : (confirmLabel ?? defaultConfirmLabel)}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

export { ConfirmDialog }
