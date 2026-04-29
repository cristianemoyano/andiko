'use client'
import * as RadixDialog from '@radix-ui/react-dialog'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const panelVariants = cva(
  [
    'fixed left-1/2 top-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2',
    'rounded-md bg-white shadow-2xl border border-zinc-200 ring-1 ring-black/5',
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
}

function Dialog({ open, onOpenChange, title, description, children, size, className, hideClose }: DialogProps) {
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
        <RadixDialog.Content className={cn(panelVariants({ size }), className)}>
          <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4">
            <div>
              <RadixDialog.Title className="text-[14px] font-semibold text-zinc-900">
                {title}
              </RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-0.5 text-[12px] text-zinc-500">
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
                className="rounded-sm text-zinc-400 transition-colors hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-1 disabled:pointer-events-none mt-0.5 flex-shrink-0"
                aria-label="Cerrar"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </RadixDialog.Close>
            )}
          </div>
          <div className="min-w-0 overflow-hidden">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

export { Dialog }
