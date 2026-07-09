'use client'

import { cn } from '@/lib/utils'

export type VentasStatusTab<T extends string> = T | ''

export interface VentasStatusNavProps<T extends string> {
  tabs: readonly { key: VentasStatusTab<T>; label: string }[]
  active: VentasStatusTab<T>
  counts: Record<VentasStatusTab<T>, number>
  onChange: (tab: VentasStatusTab<T>) => void
  ariaLabel: string
}

export function VentasStatusNav<T extends string>({
  tabs,
  active,
  counts,
  onChange,
  ariaLabel,
}: VentasStatusNavProps<T>) {
  return (
    <nav
      className="flex gap-0 overflow-x-auto border-b border-border bg-surface flex-shrink-0 px-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      aria-label={ariaLabel}
    >
      {tabs.map(tab => {
        const count = counts[tab.key]
        const isActive = active === tab.key
        return (
          <button
            key={tab.key || 'all'}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cn(
              'shrink-0 whitespace-nowrap border-b-2 -mb-px px-3 py-2.5 text-[13px] transition-colors',
              isActive
                ? 'border-brand-accent font-medium text-brand-accent'
                : 'border-transparent text-fg-muted hover:border-border hover:text-fg',
            )}
          >
            {tab.label}
            <span className={cn('ml-1 tabular-nums', isActive ? 'text-brand-accent/80' : 'text-fg-subtle')}>
              ({count})
            </span>
          </button>
        )
      })}
    </nav>
  )
}
