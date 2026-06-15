'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useSidebar } from './SidebarContext'
import { NAV_MAIN, NAV_MODULES, isModuleNavVisible, type NavItem } from './nav-items'
import { type OrgModuleKey } from '@/modules/auth/organization-modules'

/** Sections shown as primary tabs in the mobile bottom bar (in this order). */
const PRIMARY_MODULE_IDS = ['ventas', 'compras', 'contactos']

interface BottomNavProps {
  enabledModules?: OrgModuleKey[]
}

/**
 * Mobile-only sticky bottom navigation. Shows the primary sections plus a
 * "Menú" tab that opens the full navigation drawer. Hidden at md+, where the
 * static Sidebar is used instead.
 */
export function BottomNav({ enabledModules }: BottomNavProps) {
  const pathname = usePathname()
  const { open, setOpen, toggle } = useSidebar()

  const primary: NavItem[] = [
    ...NAV_MAIN,
    ...NAV_MODULES.filter(
      item => PRIMARY_MODULE_IDS.includes(item.id) && isModuleNavVisible(item.id, enabledModules),
    ),
  ]

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 flex items-stretch h-14 bg-surface border-t border-border pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegación principal"
    >
      {primary.map(item => {
        const active = item.href === '/panel' ? pathname === item.href : pathname.startsWith(item.href)
        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
              active ? 'text-brand-600' : 'text-fg-muted hover:text-fg',
            )}
          >
            <span className={cn('flex-shrink-0', active ? 'text-brand-600' : 'text-fg-subtle')}>{item.icon}</span>
            {item.label}
          </Link>
        )
      })}

      <button
        type="button"
        onClick={toggle}
        aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={open}
        className={cn(
          'flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
          open ? 'text-brand-600' : 'text-fg-muted hover:text-fg',
        )}
      >
        <span className={cn('flex-shrink-0', open ? 'text-brand-600' : 'text-fg-subtle')}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="3" cy="3" r="1.6" /><circle cx="8" cy="3" r="1.6" /><circle cx="13" cy="3" r="1.6" />
            <circle cx="3" cy="8" r="1.6" /><circle cx="8" cy="8" r="1.6" /><circle cx="13" cy="8" r="1.6" />
            <circle cx="3" cy="13" r="1.6" /><circle cx="8" cy="13" r="1.6" /><circle cx="13" cy="13" r="1.6" />
          </svg>
        </span>
        Menú
      </button>
    </nav>
  )
}
