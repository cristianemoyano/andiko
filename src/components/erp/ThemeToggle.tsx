'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

type ThemeOption = {
  value: 'light' | 'dark' | 'system'
  label: string
  icon: React.ReactNode
}

const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
)

const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
)

const SystemIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
)

const OPTIONS: ThemeOption[] = [
  { value: 'light', label: 'Claro', icon: <SunIcon /> },
  { value: 'dark', label: 'Oscuro', icon: <MoonIcon /> },
  { value: 'system', label: 'Sistema', icon: <SystemIcon /> },
]

export interface ThemeToggleProps {
  className?: string
}

function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Theme is only known on the client; render after mount to avoid a
  // hydration mismatch between the server (no theme) and the client.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-mount flag
  useEffect(() => setMounted(true), [])

  const active = mounted ? theme : undefined

  return (
    <div
      role="radiogroup"
      aria-label="Tema de la interfaz"
      className={cn('inline-flex items-center gap-1 rounded-md border border-border bg-surface p-1', className)}
    >
      {OPTIONS.map((opt) => {
        const selected = active === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={opt.label}
            onClick={() => setTheme(opt.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-sm px-3 h-8 text-[13px] font-medium transition-colors cursor-pointer',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              selected
                ? 'bg-brand-600 text-white'
                : 'text-fg-muted hover:bg-surface-hover hover:text-fg',
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export { ThemeToggle }
