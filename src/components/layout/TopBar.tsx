'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { UserMenu } from './UserMenu'
import { Tooltip } from '@/components/primitives/Tooltip'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface TopBarProps {
  breadcrumbs: BreadcrumbItem[]
  actions?: React.ReactNode
  className?: string
  /** Optional name/role fallbacks before session hydrates (Storybook). */
  userName?: string
  userEmail?: string
  userRole?: string
  /** Hide desktop user chrome (e.g. isolated stories). Default false. */
  hideChrome?: boolean
}

function NotificationBellPlaceholder() {
  return (
    <Tooltip content="Notificaciones — próximamente" side="bottom">
      <button
        type="button"
        disabled
        aria-label="Notificaciones (próximamente)"
        className={cn(
          'relative flex h-8 w-8 items-center justify-center rounded-md text-fg-subtle',
          'opacity-60 cursor-not-allowed',
        )}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
      </button>
    </Tooltip>
  )
}

export function TopBar({
  breadcrumbs,
  actions,
  className,
  userName,
  userEmail,
  userRole,
  hideChrome = false,
}: TopBarProps) {
  const lastCrumb = breadcrumbs[breadcrumbs.length - 1]
  const parentCrumb = breadcrumbs.length >= 2 ? breadcrumbs[breadcrumbs.length - 2] : null

  return (
    <header
      className={cn(
        'flex-shrink-0 z-[1] border-b border-border bg-surface',
        // Desktop: single fixed-height row
        'md:h-14 md:flex md:flex-row md:items-center md:px-5 md:gap-3',
        // Mobile: stacked column
        'flex flex-col',
        className,
      )}
    >
      {/* ── Mobile: row 1 — back chevron + current page title ── */}
      <div className="flex items-center gap-1 px-4 h-14 md:hidden">
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

      {/* ── Desktop: page actions + chrome ── */}
      <div className="hidden md:flex flex-shrink-0 items-center gap-2">
        {actions ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {actions}
          </div>
        ) : null}

        {!hideChrome && (
          <>
            {(actions || breadcrumbs.length > 0) && (
              <div className="mx-1 h-5 w-px bg-border" aria-hidden />
            )}
            <NotificationBellPlaceholder />
            <UserMenu userName={userName} userEmail={userEmail} userRole={userRole} />
          </>
        )}
      </div>
    </header>
  )
}
