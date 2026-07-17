'use client'

import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/primitives/DropdownMenu'
import { cn } from '@/lib/utils'

interface UserMenuProps {
  userName?: string
  userEmail?: string
  userRole?: string
  className?: string
  /** Show name next to avatar (desktop). Default true. */
  showLabel?: boolean
}

function initialsFromName(name: string | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map(n => n[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'
}

export function UserMenu({
  userName,
  userEmail,
  userRole,
  className,
  showLabel = true,
}: UserMenuProps) {
  const { data: session } = useSession()

  const displayEmail = session?.user?.email ?? userEmail ?? ''
  const displayName = session?.user?.name ?? userName ?? (displayEmail || '—')
  const displayRole = session?.user?.role ?? userRole ?? ''
  const initials = initialsFromName(
    displayName !== '—' && displayName !== displayEmail
      ? displayName
      : displayEmail || undefined,
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="user-menu-trigger"
          className={cn(
            'flex items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors',
            'hover:bg-surface-hover',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
            className,
          )}
          aria-label="Menú de usuario"
        >
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-accent-bg text-[11px] font-semibold text-brand-accent ring-1 ring-brand-accent-border/50">
            {initials}
          </span>
          {showLabel && (
            <span className="hidden min-w-0 max-w-[140px] lg:block">
              <span className="block truncate text-[13px] font-medium leading-tight text-fg">
                {displayName}
              </span>
              {displayRole ? (
                <span className="block truncate text-[11px] leading-tight text-fg-subtle">
                  {displayRole}
                </span>
              ) : null}
            </span>
          )}
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="hidden flex-shrink-0 text-fg-subtle sm:block"
            aria-hidden
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-[220px]">
        <DropdownMenuLabel className="normal-case tracking-normal">
          <div className="truncate text-[13px] font-medium text-fg">{displayName}</div>
          {displayEmail && displayEmail !== displayName ? (
            <div className="mt-0.5 truncate text-[11px] font-normal normal-case tracking-normal text-fg-muted">
              {displayEmail}
            </div>
          ) : null}
          {displayRole ? (
            <div className="mt-0.5 truncate text-[11px] font-normal normal-case tracking-normal text-fg-subtle">
              {displayRole}
            </div>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/perfil" className="cursor-pointer">
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="8" cy="5.5" r="2.5" />
              <path d="M3 13.5c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5" />
            </svg>
            Mi perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          data-testid="logout-btn"
          onSelect={() => {
            void signOut({ callbackUrl: '/login' })
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M10 11l3-3-3-3M13 8H6" />
          </svg>
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
