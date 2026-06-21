'use client'

import { Tooltip } from '@/components/primitives/Tooltip'
import { cn } from '@/lib/utils'

export interface KpiInfoIconProps {
  content: string
  className?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Accessible name; defaults to "Más información sobre {label}" when used via KpiLabel. */
  ariaLabel?: string
}

export function KpiInfoIcon({ content, className, side = 'top', ariaLabel = 'Más información' }: KpiInfoIconProps) {
  return (
    <Tooltip content={content} side={side}>
      <button
        type="button"
        className={cn(
          'inline-flex shrink-0 rounded-full p-0.5 text-fg-subtle hover:text-fg hover:bg-surface-hover transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
          className,
        )}
        aria-label={ariaLabel}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      </button>
    </Tooltip>
  )
}

export interface KpiLabelProps {
  label: string
  info?: string
  className?: string
  labelClassName?: string
}

/** KPI caption with optional info tooltip (ⓘ). */
export function KpiLabel({ label, info, className, labelClassName }: KpiLabelProps) {
  return (
    <div className={cn('flex items-center gap-1 min-w-0', className)}>
      <span className={cn('truncate', labelClassName)}>{label}</span>
      {info ? <KpiInfoIcon content={info} ariaLabel={`Más información sobre ${label}`} /> : null}
    </div>
  )
}
