'use client'
import * as RadixDialog from '@radix-ui/react-dialog'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const panelVariants = cva(
  [
    'fixed left-1/2 top-1/2 z-50 flex flex-col -translate-x-1/2 -translate-y-1/2',
    // Mobile: 1rem gutter each side + cap height so tall content scrolls instead of overflowing.
    'w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)] overflow-hidden',
    'rounded-md bg-surface shadow-2xl border border-border ring-1 ring-black/5',
    'focus:outline-none',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
    'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
    'data-[state=closed]:slide-out-to-left-1/2 data-[state=open]:slide-in-from-left-1/2',
    'data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-top-[48%]',
    'duration-200',
  ].join(' '),
  {
    variants: {
      size: {
        sm: 'max-w-sm',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

export interface DialogProps extends VariantProps<typeof panelVariants> {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  className?: string
  hideClose?: boolean
  /** Body padding (default true). Use false when the child manages its own layout (split footers). */
  padded?: boolean
  /** Acciones fijas al pie del modal, fuera del área con scroll. */
  footer?: React.ReactNode
  /** Selector estable para tests E2E (data-testid en el panel). */
  contentTestId?: string
}

export interface DialogFooterProps {
  children: React.ReactNode
  className?: string
  /** Error inline sobre los botones (p. ej. validación al enviar). */
  error?: string | null
}

function DialogFooter({ children, className, error }: DialogFooterProps) {
  return (
    <div
      className={cn(
        'flex flex-shrink-0 flex-col gap-2 border-t border-border bg-surface px-5 py-3',
        className,
      )}
    >
      {error ? (
        <p className="text-danger text-[13px] leading-snug" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {children}
      </div>
    </div>
  )
}

function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  size,
  className,
  hideClose,
  padded = true,
  footer,
  contentTestId,
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          className={cn(
            // Cubre todo el viewport: misma capa oscurece y desenfoca *toda* la página detrás
            'fixed inset-0 z-50 bg-black/50',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'duration-200',
          )}
        />
        <RadixDialog.Content
          className={cn(panelVariants({ size }), className)}
          data-testid={contentTestId}
        >
          <div className="flex flex-shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <RadixDialog.Title className="text-[14px] font-semibold text-fg">
                {title}
              </RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-0.5 text-[12px] text-fg-muted">
                  {description}
                </RadixDialog.Description>
              ) : (
                <RadixDialog.Description className="sr-only">
                  {title}
                </RadixDialog.Description>
              )}
            </div>
            {!hideClose && (
              <RadixDialog.Close
                className="rounded-sm text-fg-subtle transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-1 disabled:pointer-events-none mt-0.5 flex-shrink-0"
                aria-label="Cerrar"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </RadixDialog.Close>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className={cn(padded && 'px-5 py-4')}>{children}</div>
          </div>
          {footer}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

export { Dialog, DialogFooter }
