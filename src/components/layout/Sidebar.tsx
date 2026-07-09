'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { AppVersion } from './AppVersion'
import { SysAdminImpersonation } from './SysAdminImpersonation'
import { useSidebar } from './SidebarContext'
import { NAV_MAIN, NAV_MODULES, NAV_SYSTEM, NAV_WOOCOMMERCE, isModuleNavVisible, type NavItem } from './nav-items'
import { type OrgModuleKey } from '@/modules/auth/organization-modules'
import { useCapabilities } from './CapabilitiesContext'

interface SidebarProps {
  userName?: string
  userRole?: string
  /** Signed-in account is sys-admin (including while impersonating another user) */
  isRealSysAdmin?: boolean
  /** Show link to Organizaciones: real sys-admin and not impersonating */
  /** Initial value from server layout (used until client session hydrates) */
  showSysAdminNavigation?: boolean
  /** Módulos habilitados para la org; undefined = todos visibles (sys-admin sin org) */
  enabledModules?: OrgModuleKey[]
  /** Onboarding incompleto con progreso guardado — mostrar acceso al asistente */
  showOnboardingResume?: boolean
}

export function Sidebar({
  userName,
  userRole,
  isRealSysAdmin = false,
  showSysAdminNavigation: showSysAdminNavigationInitial = false,
  enabledModules,
  showOnboardingResume = false,
}: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { open, setOpen } = useSidebar()
  const { capabilities } = useCapabilities()
  const navCapabilities = capabilities?.nav ?? null

  // Re-read from client session so nav updates when impersonation starts/stops without refresh.
  const showSysAdminNavigation = session?.user
    ? session.user.realRole === 'sys-admin' && !session.user.impersonation
    : showSysAdminNavigationInitial

  const displayName = session?.user?.name ?? session?.user?.email ?? userName
  const displayRole = session?.user?.role ?? userRole

  const permissions = capabilities?.permissions
  const showPanel = navCapabilities?.panel === true
  const visibleMain = NAV_MAIN.filter(item => item.id !== 'dashboard' || showPanel)
  const visibleModules = NAV_MODULES.filter(item => isModuleNavVisible(item.id, enabledModules, permissions))
  const showPosSection = isModuleNavVisible('pos-dispositivos', enabledModules, permissions)

  const initials = displayName
    ? displayName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <>
      {/* Backdrop — mobile only, when the drawer is open */}
      {open && (
        <div
          className="fixed inset-x-0 top-0 bottom-14 z-40 bg-black/40 md:hidden"
          aria-hidden
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        data-testid="sidebar"
        className={cn(
          'flex flex-col w-[220px] flex-shrink-0 bg-surface h-full z-[1]',
          'shadow-[2px_0_12px_rgba(0,0,0,0.05)] dark:shadow-[2px_0_12px_rgba(0,0,0,0.35)]',
          // Mobile: off-canvas drawer that slides in from the left.
          'fixed inset-y-0 left-0 z-[45] transition-transform duration-200',
          'pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0',
          open ? 'translate-x-0' : '-translate-x-full',
          // Desktop (md+): static column in the flex row, always visible.
          'md:static md:z-auto md:translate-x-0'
        )}
      >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-[13px] bg-brand-accent-bg/40">
        <div className="w-[22px] h-[22px] bg-brand-600 rounded-sm flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 12 12" className="w-3 h-3 fill-white">
            <rect x="0" y="1" width="3" height="10"/>
            <rect x="0" y="1" width="12" height="3"/>
            <rect x="9" y="1" width="3" height="10"/>
            <rect x="2" y="5" width="8" height="2.5"/>
          </svg>
        </div>
        <span className="text-[15px] font-semibold text-fg tracking-tight">andiko</span>
        <AppVersion className="ml-auto" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-1.5">
        {isRealSysAdmin && (
          <>
            <SectionLabel>Administración</SectionLabel>
            {showSysAdminNavigation && (
              <>
                <NavLink
                  item={{
                    id: 'sys-admin-orgs',
                    label: 'Organizaciones',
                    href: '/organizaciones',
                    icon: (
                      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M3 14h10M3 10h10M5 6h6M5 2h6M2 14V6l6-4 6 4v8"/>
                      </svg>
                    ),
                  }}
                  active={pathname.startsWith('/organizaciones')}
                />
                <NavLink
                  item={{
                    id: 'sys-admin-email',
                    label: 'Email (SMTP)',
                    href: '/sys-admin/email',
                    icon: (
                      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <rect x="1.5" y="3" width="13" height="10" rx="1"/><path d="m2 4 6 5 6-5"/>
                      </svg>
                    ),
                  }}
                  active={pathname.startsWith('/sys-admin/email')}
                />
                <NavLink
                  item={{
                    id: 'sys-admin-storage',
                    label: 'Almacenamiento',
                    href: '/sys-admin/storage',
                    icon: (
                      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 4.5 8 1.5l6 3v7L8 14.5 2 11.5v-7z"/><path d="M8 1.5v13"/>
                      </svg>
                    ),
                  }}
                  active={pathname.startsWith('/sys-admin/storage')}
                />
                <NavLink
                  item={{
                    id: 'sys-admin-billing',
                    label: 'Facturación',
                    href: '/sys-admin/billing',
                    icon: (
                      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="12" height="10" rx="1"/><path d="M2 6h12M5 10h3"/>
                      </svg>
                    ),
                  }}
                  active={pathname.startsWith('/sys-admin/billing')}
                />
              </>
            )}
            <SysAdminImpersonation />
          </>
        )}

        <SectionLabel>Principal</SectionLabel>
        {visibleMain.map(item => (
          <NavLink key={item.id} item={item} active={pathname === item.href} />
        ))}

        <SectionLabel>Módulos</SectionLabel>
        {visibleModules.map(item => (
          <NavLink key={item.id} item={item} active={pathname.startsWith(item.href)} />
        ))}

        {showPosSection && (
          <>
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
        <NavLink
          item={{
            id: 'pos-medios-de-pago',
            label: 'Medios de pago',
            href: '/pos/medios-de-pago',
            icon: (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
            ),
          }}
          active={pathname.startsWith('/pos/medios-de-pago')}
        />
        <NavLink
          item={{
            id: 'pos-balanzas',
            label: 'Balanzas',
            href: '/pos/balanzas',
            icon: (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v2M5 5h14l-2.5 6h-9L5 5zM3.5 11h17"/><path d="M6 11l-2 7h6l-2-7M18 11l-2 7h6l-2-7M9 21h6"/>
              </svg>
            ),
          }}
          active={pathname.startsWith('/pos/balanzas')}
        />
          </>
        )}

        <SectionLabel>Sistema</SectionLabel>
        {showOnboardingResume && !pathname.startsWith('/onboarding') && (
          <NavLink
            item={{
              id: 'onboarding-resume',
              label: 'Configuración inicial',
              href: '/onboarding',
              icon: (
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 1.5"/>
                </svg>
              ),
            }}
            active={pathname.startsWith('/onboarding')}
          />
        )}
        {navCapabilities?.organizaciones && navCapabilities.organizacionesHref && !showSysAdminNavigation && (
          <NavLink
            item={{
              id: 'organizacion',
              label: 'Organización',
              href: navCapabilities.organizacionesHref,
              icon: (
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M3 14h10M3 10h10M5 6h6M5 2h6M2 14V6l6-4 6 4v8"/>
                </svg>
              ),
            }}
            active={pathname.startsWith('/organizaciones')}
          />
        )}
        {navCapabilities?.facturacion && (
          <NavLink
            item={{
              id: 'facturacion',
              label: 'Suscripción',
              href: '/facturacion',
              icon: (
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="12" height="10" rx="1"/><path d="M2 6h12M5 10h3"/>
                </svg>
              ),
            }}
            active={pathname.startsWith('/facturacion')}
          />
        )}
        {navCapabilities?.integraciones && (
          <NavLink
            item={NAV_WOOCOMMERCE}
            active={pathname.startsWith('/integraciones/woocommerce')}
          />
        )}
        {NAV_SYSTEM.filter(item => item.id !== 'configuracion' || navCapabilities?.configuracion !== false).map(item => (
          <NavLink key={item.id} item={item} active={pathname.startsWith(item.href)} />
        ))}
      </nav>

      {/* User area */}
      <div className="flex items-center gap-2.5 px-3 py-3 mt-1 bg-surface-muted/40">
        <Link href="/perfil" onClick={() => setOpen(false)} className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-80 transition-opacity">
          <div className="w-[26px] h-[26px] rounded-full bg-brand-accent-bg text-brand-accent text-[11px] font-semibold flex items-center justify-center flex-shrink-0 ring-1 ring-brand-accent-border/60">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-fg truncate">{displayName ?? '—'}</div>
            <div className="text-[11px] text-fg-subtle truncate">{displayRole ?? ''}</div>
          </div>
        </Link>
        <button
          type="button"
          data-testid="logout-btn"
          onClick={() => signOut({ callbackUrl: '/login' })}
          title="Cerrar sesión"
          className="flex-shrink-0 text-fg-subtle hover:text-fg-muted transition-colors cursor-pointer"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M10 11l3-3-3-3M13 8H6"/>
          </svg>
        </button>
      </div>
      </aside>
    </>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold text-fg-subtle uppercase tracking-widest px-2 pt-3 pb-1">
      {children}
    </div>
  )
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const { setOpen } = useSidebar()
  return (
    <Link
      href={item.href}
      onClick={() => setOpen(false)}
      className={cn(
        'flex items-center gap-2.5 h-[34px] px-2 rounded-sm text-[13px] mb-px transition-colors',
        active
          ? 'bg-brand-accent-bg text-brand-accent font-medium'
          : 'text-fg-muted hover:bg-surface-hover'
      )}
    >
      <span className={cn('flex-shrink-0', active ? 'text-brand-accent' : 'text-fg-subtle')}>
        {item.icon}
      </span>
      {item.label}
      {item.badge != null && (
        <span className="ml-auto text-[10px] font-semibold bg-warning-bg text-warning rounded-sm px-1.5 h-4 flex items-center">
          {item.badge}
        </span>
      )}
    </Link>
  )
}
