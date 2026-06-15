'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface TopBarProps {
  breadcrumbs: BreadcrumbItem[]
  actions?: React.ReactNode
  className?: string
}

export function TopBar({ breadcrumbs, actions, className }: TopBarProps) {
  return (
    <header
      className={cn(
        'min-h-[52px] md:h-[52px] bg-surface border-b border-border flex items-center px-5 gap-3 flex-shrink-0',
        className
      )}
    >
      <nav className="flex items-center gap-1.5 flex-1 min-w-0" aria-label="Breadcrumb">
        {breadcrumbs.map((crumb, i) => {
          const isLast = i === breadcrumbs.length - 1
          return (
            <span key={i} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && (
                <span className="text-fg-subtle text-sm flex-shrink-0">›</span>
              )}
              {isLast || !crumb.href ? (
                <span
                  className={cn(
                    'truncate',
                    isLast
                      ? 'text-[14px] font-semibold text-fg tracking-tight'
                      : 'text-[13px] text-fg-muted'
                  )}
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-[13px] text-fg-muted hover:text-fg transition-colors truncate"
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          )
        })}
      </nav>

      {actions && (
        <div className="flex flex-wrap items-center justify-end gap-2 flex-shrink-0">
          {actions}
        </div>
      )}
    </header>
  )
}
