'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useSidebar } from './SidebarContext'

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
  const { toggle } = useSidebar()
  return (
    <header
      className={cn(
        'min-h-[52px] md:h-[52px] bg-white border-b border-zinc-200 flex items-center px-5 gap-3 flex-shrink-0',
        className
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label="Abrir menú"
        className="md:hidden -ml-1 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-sm text-zinc-600 transition-colors hover:bg-zinc-100"
      >
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M2 4h12M2 8h12M2 12h12" />
        </svg>
      </button>

      <nav className="flex items-center gap-1.5 flex-1 min-w-0" aria-label="Breadcrumb">
        {breadcrumbs.map((crumb, i) => {
          const isLast = i === breadcrumbs.length - 1
          return (
            <span key={i} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && (
                <span className="text-zinc-300 text-sm flex-shrink-0">›</span>
              )}
              {isLast || !crumb.href ? (
                <span
                  className={cn(
                    'truncate',
                    isLast
                      ? 'text-[14px] font-semibold text-zinc-900 tracking-tight'
                      : 'text-[13px] text-zinc-500'
                  )}
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-[13px] text-zinc-500 hover:text-zinc-800 transition-colors truncate"
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
