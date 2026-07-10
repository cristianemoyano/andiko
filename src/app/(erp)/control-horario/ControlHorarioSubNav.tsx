'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/control-horario', label: 'Mi fichaje' },
  { href: '/control-horario/empleados', label: 'Empleados' },
  { href: '/control-horario/registros', label: 'Registros' },
] as const

export function ControlHorarioSubNav() {
  const pathname = usePathname()
  return (
    <nav
      className="flex gap-1 overflow-x-auto px-5 py-2 bg-surface-muted border-b border-border flex-shrink-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Secciones de control de horario"
    >
      {LINKS.map(({ href, label }) => {
        const active = href === '/control-horario' ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'shrink-0 whitespace-nowrap px-3 py-1 text-[13px] rounded-sm transition-colors',
              active
                ? 'bg-surface border border-border text-fg font-medium shadow-sm'
                : 'text-fg-muted hover:text-fg hover:bg-surface-hover/80'
            )}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
