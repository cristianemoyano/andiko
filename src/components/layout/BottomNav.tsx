'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useSidebar } from './SidebarContext'
import { NAV_MAIN, NAV_MODULES, isModuleNavVisible, type NavItem } from './nav-items'
import { type OrgModuleKey } from '@/modules/auth/organization-modules'
import { useCapabilities } from './CapabilitiesContext'

/** Sections shown as primary tabs in the mobile bottom bar (in this order). */
const PRIMARY_MODULE_IDS = ['ventas', 'catalogo']

/** Shorter labels for cramped mobile tabs (falls back to NavItem.label). */
const BOTTOM_NAV_LABELS: Partial<Record<string, string>> = {
  catalogo: 'Productos',
}

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
  const { setOpen, menuOpen, toggleMenu } = useSidebar()
  const { capabilities } = useCapabilities()
  const permissions = capabilities?.permissions
  const showPanel = capabilities?.nav.panel === true

  const primary: NavItem[] = [
    ...(showPanel ? NAV_MAIN : []),
    ...NAV_MODULES.filter(
      item => PRIMARY_MODULE_IDS.includes(item.id) && isModuleNavVisible(item.id, enabledModules, permissions),
    ),
  ]

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-surface border-t border-border pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegación principal"
    >
      <div className="flex h-16 items-stretch">
      {primary.map(item => {
        const active = item.href === '/panel' ? pathname === item.href : pathname.startsWith(item.href)
        const label = BOTTOM_NAV_LABELS[item.id] ?? item.label
        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={() => { setOpen(false) }}
            className={cn(
              'relative flex flex-1 min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 text-[11px] font-medium leading-tight transition-colors',
              active ? 'text-brand-accent' : 'text-fg-muted hover:text-fg',
              active && 'before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:h-0.5 before:w-8 before:rounded-full before:bg-brand-accent',
            )}
          >
            <span className={cn('flex shrink-0 [&_svg]:size-5', active ? 'text-brand-accent' : 'text-fg-subtle')}>
              {item.icon}
            </span>
            <span className="truncate max-w-full">{label}</span>
          </Link>
        )
      })}

      <button
        type="button"
        onClick={toggleMenu}
        aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={menuOpen}
        className={cn(
          'relative flex flex-1 min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 text-[11px] font-medium leading-tight transition-colors',
          menuOpen ? 'text-brand-accent' : 'text-fg-muted hover:text-fg',
          menuOpen && 'before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:h-0.5 before:w-8 before:rounded-full before:bg-brand-accent',
        )}
      >
        <span className={cn('flex shrink-0', menuOpen ? 'text-brand-accent' : 'text-fg-subtle')}>
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="3" cy="3" r="1.6" /><circle cx="8" cy="3" r="1.6" /><circle cx="13" cy="3" r="1.6" />
            <circle cx="3" cy="8" r="1.6" /><circle cx="8" cy="8" r="1.6" /><circle cx="13" cy="8" r="1.6" />
            <circle cx="3" cy="13" r="1.6" /><circle cx="8" cy="13" r="1.6" /><circle cx="13" cy="13" r="1.6" />
          </svg>
        </span>
        Menú
      </button>

      </div>
    </nav>
  )
}
