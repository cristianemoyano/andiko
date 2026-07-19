'use client'

import { Badge } from '@/components/primitives/Badge'
import { cn } from '@/lib/utils'

export type DocumentStatusTab<T extends string> = T | ''

export interface DocumentStatusNavProps<T extends string> {
  tabs: readonly { key: DocumentStatusTab<T>; label: string }[]
  active: DocumentStatusTab<T>
  counts: Record<DocumentStatusTab<T>, number>
  onChange: (tab: DocumentStatusTab<T>) => void
  ariaLabel: string
}

/** Navegación compartida por estado para documentos de ventas y compras. */
export function DocumentStatusNav<T extends string>({
  tabs,
  active,
  counts,
  onChange,
  ariaLabel,
}: DocumentStatusNavProps<T>) {
  return (
    <nav
      className="flex flex-shrink-0 gap-0 overflow-x-auto border-b border-border bg-surface px-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
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
              '-mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] transition-colors',
              isActive
                ? 'border-brand-accent font-medium text-brand-accent'
                : 'border-transparent text-fg-muted hover:border-border hover:text-fg',
            )}
          >
            {tab.label}
            <Badge
              status={isActive ? 'info' : 'neutral'}
              className="min-w-[1.25rem] justify-center px-1.5 py-0 tabular-nums"
              aria-label={`${count} documentos`}
            >
              {count}
            </Badge>
          </button>
        )
      })}
    </nav>
  )
}
