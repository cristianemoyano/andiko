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
  const lastCrumb = breadcrumbs[breadcrumbs.length - 1]
  const parentCrumb = breadcrumbs.length >= 2 ? breadcrumbs[breadcrumbs.length - 2] : null

  return (
    <header
      className={cn(
        'bg-surface flex-shrink-0 z-[1] shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:shadow-[0_1px_4px_rgba(0,0,0,0.22)]',
        // Desktop: single fixed-height row
        'md:h-[52px] md:flex md:flex-row md:items-center md:px-5 md:gap-3',
        // Mobile: stacked column
        'flex flex-col',
        className,
      )}
    >
      {/* ── Mobile: row 1 — back chevron + current page title ── */}
      <div className="flex items-center gap-1 px-4 h-[52px] md:hidden">
        {parentCrumb?.href ? (
          <Link
            href={parentCrumb.href}
            aria-label={`Volver a ${parentCrumb.label}`}
            className="flex-shrink-0 -ml-1 p-1.5 text-fg-muted hover:text-fg transition-colors"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
        ) : null}
        <div className="min-w-0 flex flex-col justify-center">
          {parentCrumb && breadcrumbs.length >= 2 && (
            <span className="text-[11px] text-fg-muted truncate leading-tight">
              {parentCrumb.label}
            </span>
          )}
          <span className="text-[17px] font-semibold text-fg tracking-tight truncate leading-tight">
            {lastCrumb?.label ?? ''}
          </span>
        </div>
      </div>

      {/* ── Mobile: row 2 — actions (only rendered when actions prop is provided) ── */}
      {actions ? (
        <div className="flex w-full flex-col gap-2 px-4 pb-3 md:hidden [&_button]:w-full sm:flex-row sm:flex-wrap sm:[&_button]:w-auto">
          {actions}
        </div>
      ) : null}

      {/* ── Desktop: breadcrumb trail ── */}
      <nav className="hidden md:flex items-center gap-1.5 flex-1 min-w-0" aria-label="Breadcrumb">
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

      {/* ── Desktop: actions ── */}
      {actions ? (
        <div className="hidden md:flex flex-wrap items-center justify-end gap-2 flex-shrink-0">
          {actions}
        </div>
      ) : null}
    </header>
  )
}
