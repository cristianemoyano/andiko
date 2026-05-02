'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { SysAdminImpersonation } from './SysAdminImpersonation'

interface NavItem {
  id: string
  label: string
  href: string
  icon: React.ReactNode
  badge?: number
}

const NAV_MAIN: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Panel',
    href: '/',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/>
        <rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/>
      </svg>
    ),
  },
]

const NAV_MODULES: NavItem[] = [
  {
    id: 'ventas',
    label: 'Ventas',
    href: '/ventas',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M9 1H3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6L9 1z"/><path d="M9 1v5h5M5 9h6M5 12h4"/>
      </svg>
    ),
  },
  {
    id: 'inventario',
    label: 'Inventario',
    href: '/inventario',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M2 4l6-2 6 2v8l-6 2-6-2V4z"/><path d="M8 2v12M2 4l6 2 6-2"/>
      </svg>
    ),
  },
  {
    id: 'compras',
    label: 'Compras',
    href: '/compras',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M1 1h2l2 8h7l2-5H5"/><circle cx="7" cy="13" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="13" r="1" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    id: 'contabilidad',
    label: 'Contabilidad',
    href: '/contabilidad',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M2 14h12M4 14V9M8 14V5M12 14V9"/>
      </svg>
    ),
  },
  {
    id: 'contactos',
    label: 'Contactos',
    href: '/contactos',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="6" cy="5" r="2.5"/><path d="M1 14c0-2.76 2.24-5 5-5h0c2.76 0 5 2.24 5 5"/><circle cx="12" cy="5" r="2"/><path d="M11 10c1.5 0 4 .9 4 2.5v1.5"/>
      </svg>
    ),
  },
  {
    id: 'catalogo',
    label: 'Catálogo',
    href: '/catalogo',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <rect x="1" y="2" width="14" height="3" rx="0.5"/><rect x="1" y="7" width="14" height="3" rx="0.5"/><rect x="1" y="12" width="14" height="2" rx="0.5"/>
      </svg>
    ),
  },
]

const NAV_SYSTEM: NavItem[] = [
  {
    id: 'configuracion',
    label: 'Configuración',
    href: '/configuracion',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="8" cy="8" r="2.5"/><path d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.2 3.2l.7.7M12.1 12.1l.7.7M3.2 12.8l.7-.7M12.1 3.9l.7-.7"/>
      </svg>
    ),
  },
]

interface SidebarProps {
  userName?: string
  userRole?: string
  /** Signed-in account is sys-admin (including while impersonating another user) */
  isRealSysAdmin?: boolean
  /** Show link to Organizaciones: real sys-admin and not impersonating */
  showSysAdminNavigation?: boolean
}

export function Sidebar({
  userName,
  userRole,
  isRealSysAdmin = false,
  showSysAdminNavigation = false,
}: SidebarProps) {
  const pathname = usePathname()

  const initials = userName
    ? userName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <aside className="flex flex-col w-[220px] flex-shrink-0 bg-white border-r border-zinc-200 h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-[13px] border-b border-zinc-200">
        <div className="w-[22px] h-[22px] bg-brand-600 rounded-sm flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 12 12" className="w-3 h-3 fill-white">
            <rect x="0" y="1" width="3" height="10"/>
            <rect x="0" y="1" width="12" height="3"/>
            <rect x="9" y="1" width="3" height="10"/>
            <rect x="2" y="5" width="8" height="2.5"/>
          </svg>
        </div>
        <span className="text-[15px] font-semibold text-zinc-900 tracking-tight">andiko</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-1.5">
        {isRealSysAdmin && (
          <>
            <SectionLabel>Administración</SectionLabel>
            {showSysAdminNavigation && (
              <NavLink
                item={{
                  id: 'sys-admin-orgs',
                  label: 'Organizaciones',
                  href: '/sys-admin/organizaciones',
                  icon: (
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M3 14h10M3 10h10M5 6h6M5 2h6M2 14V6l6-4 6 4v8"/>
                    </svg>
                  ),
                }}
                active={pathname.startsWith('/sys-admin')}
              />
            )}
            <SysAdminImpersonation />
          </>
        )}

        <SectionLabel>Principal</SectionLabel>
        {NAV_MAIN.map(item => (
          <NavLink key={item.id} item={item} active={pathname === item.href} />
        ))}

        <SectionLabel>Módulos</SectionLabel>
        {NAV_MODULES.map(item => (
          <NavLink key={item.id} item={item} active={pathname.startsWith(item.href)} />
        ))}

        <SectionLabel>POS</SectionLabel>
        <NavLink
          item={{
            id: 'pos-dispositivos',
            label: 'Dispositivos',
            href: '/pos/dispositivos',
            icon: (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <rect x="1" y="3" width="14" height="10" rx="1.5"/><path d="M5 13v2M11 13v2M3 15h10"/>
              </svg>
            ),
          }}
          active={pathname === '/pos/dispositivos'}
        />
        <NavLink
          item={{
            id: 'pos-cajas',
            label: 'Turnos de caja',
            href: '/pos/cajas',
            icon: (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            ),
          }}
          active={pathname.startsWith('/pos/cajas')}
        />

        <SectionLabel>Sistema</SectionLabel>
        {NAV_SYSTEM.map(item => (
          <NavLink key={item.id} item={item} active={pathname.startsWith(item.href)} />
        ))}
      </nav>

      {/* User area */}
      <div className="flex items-center gap-2.5 px-3 py-3 border-t border-zinc-200">
        <Link href="/perfil" className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-80 transition-opacity">
          <div className="w-[26px] h-[26px] rounded-full bg-brand-100 text-brand-800 text-[11px] font-semibold flex items-center justify-center flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-zinc-900 truncate">{userName ?? '—'}</div>
            <div className="text-[11px] text-zinc-400 truncate">{userRole ?? ''}</div>
          </div>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          title="Cerrar sesión"
          className="flex-shrink-0 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M10 11l3-3-3-3M13 8H6"/>
          </svg>
        </button>
      </div>
    </aside>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest px-2 pt-3 pb-1">
      {children}
    </div>
  )
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-2.5 h-[34px] px-2 rounded-sm text-[13px] mb-px transition-colors',
        active
          ? 'bg-brand-50 text-brand-600 font-medium'
          : 'text-zinc-700 hover:bg-zinc-100'
      )}
    >
      <span className={cn('flex-shrink-0', active ? 'text-brand-600' : 'text-zinc-400')}>
        {item.icon}
      </span>
      {item.label}
      {item.badge != null && (
        <span className="ml-auto text-[10px] font-semibold bg-amber-100 text-amber-800 rounded-sm px-1.5 h-4 flex items-center">
          {item.badge}
        </span>
      )}
    </Link>
  )
}
