'use client'

import * as Popover from '@radix-ui/react-popover'
import { cn } from '@/lib/utils'

export interface HelpBubbleProps {
  /** Título breve del panel de ayuda (dentro de la burbuja). */
  title: string
  /** Etiqueta visible junto al ícono, p. ej. "Stock". */
  label?: string
  children: React.ReactNode
  className?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
}

function QuestionMarkIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  )
}

/**
 * Icono de ayuda (?) que al hacer clic despliega un panel tipo burbuja con contexto.
 * Tono profesional; pensado para pantallas del ERP.
 */
export function HelpBubble({
  title,
  label,
  children,
  className,
  side = 'bottom',
  align = 'start',
}: HelpBubbleProps) {
  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      {label ? (
        <span className="text-[15px] font-semibold text-fg tracking-tight">{label}</span>
      ) : null}
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded-full',
              'border border-border-strong bg-surface text-fg-muted',
              'hover:border-brand-accent-border hover:bg-brand-accent-bg hover:text-brand-accent',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
              'transition-colors',
            )}
            aria-label={label ? `Ayuda sobre ${label}` : `Ayuda: ${title}`}
          >
            <QuestionMarkIcon />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side={side}
            align={align}
            sideOffset={8}
            collisionPadding={12}
            className={cn(
              'z-[120] w-[min(100vw-2rem,22rem)] rounded-lg border border-border bg-surface p-4 shadow-lg',
              'text-[12px] leading-relaxed text-fg-muted',
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
              'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
              'duration-150',
            )}
          >
            <p className="font-semibold text-fg text-[13px] mb-2 pr-4">{title}</p>
            <div className="space-y-2">{children}</div>
            <Popover.Arrow className="fill-surface stroke-border" width={12} height={6} />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}
