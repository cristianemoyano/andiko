'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { AndikoLogo } from './AndikoLogo'
import { AndikoMark } from './AndikoMark'
import { AppVersion } from './AppVersion'
import { SysAdminImpersonation } from './SysAdminImpersonation'
import { useSidebar } from './SidebarContext'
import { NAV_MAIN, NAV_MODULES, NAV_SYSTEM, NAV_WOOCOMMERCE, isModuleNavVisible, type NavItem } from './nav-items'
import { type OrgModuleKey } from '@/modules/auth/organization-modules'
import { useCapabilities } from './CapabilitiesContext'
import { Tooltip } from '@/components/primitives/Tooltip'

interface SidebarProps {
  /** Signed-in account is sys-admin (including while impersonating another user) */
  isRealSysAdmin?: boolean
  /** Initial value from server layout (used until client session hydrates) */
  showSysAdminNavigation?: boolean
  /** Módulos habilitados para la org; undefined = todos visibles (sys-admin sin org) */
  enabledModules?: OrgModuleKey[]
  /** Onboarding incompleto con progreso guardado — mostrar acceso al asistente */
  showOnboardingResume?: boolean
}

export function Sidebar({
  isRealSysAdmin = false,
  showSysAdminNavigation: showSysAdminNavigationInitial = false,
  enabledModules,
  showOnboardingResume = false,
}: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { open, setOpen, collapsed, toggleCollapsed } = useSidebar()
  const { capabilities } = useCapabilities()
  const navCapabilities = capabilities?.nav ?? null

  // Re-read from client session so nav updates when impersonation starts/stops without refresh.
  const showSysAdminNavigation = session?.user
    ? session.user.realRole === 'sys-admin' && !session.user.impersonation
    : showSysAdminNavigationInitial

  const permissions = capabilities?.permissions
  const showPanel = navCapabilities?.panel === true
  const visibleMain = NAV_MAIN.filter(item => item.id !== 'dashboard' || showPanel)
  const visibleModules = NAV_MODULES.filter(item => isModuleNavVisible(item.id, enabledModules, permissions))
  const showPosSection = isModuleNavVisible('pos-dispositivos', enabledModules, permissions)

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
        data-collapsed={collapsed ? 'true' : 'false'}
        className={cn(
          'flex flex-col flex-shrink-0 bg-surface h-full z-[1]',
          'border-r border-border',
          'transition-[width] duration-200 ease-out',
          // Mobile drawer always expanded width; desktop follows collapse
          'w-[240px]',
          collapsed ? 'md:w-14' : 'md:w-[240px]',
          // Mobile: off-canvas drawer that slides in from the left.
          'fixed inset-y-0 left-0 z-[45] transition-transform duration-200',
          'pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0',
          open ? 'translate-x-0' : '-translate-x-full',
          // Desktop (md+): static column in the flex row, always visible.
          'md:static md:z-auto md:translate-x-0',
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            'flex h-14 flex-shrink-0 items-center border-b border-border',
            collapsed ? 'justify-center px-0 md:px-0 px-3' : 'gap-2 px-3',
          )}
        >
          {/* Expanded: full wordmark (always on mobile drawer) */}
          <div className={cn('min-w-0 flex-1', collapsed && 'md:hidden')}>
            <AndikoLogo href="/" size="xs" className="min-w-0" />
          </div>
          {/* Collapsed desktop: mark only */}
          {collapsed && (
            <Link
              href="/"
              className="hidden items-center justify-center md:flex"
              aria-label="Andiko — inicio"
            >
              <AndikoMark size="xs" tone="brand" />
            </Link>
          )}
          {!collapsed && <AppVersion className="hidden shrink-0 md:inline" />}
        </div>

        {/* Navigation */}
        <nav
          className={cn(
            'flex-1 overflow-x-hidden overflow-y-auto py-2',
            collapsed ? 'px-2 md:px-1.5' : 'px-2',
          )}
        >
          {isRealSysAdmin && (
            <>
              <SectionLabel collapsed={collapsed}>Administración</SectionLabel>
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
                    collapsed={collapsed}
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
                    collapsed={collapsed}
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
                    collapsed={collapsed}
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
                    collapsed={collapsed}
                  />
                </>
              )}
              <SysAdminImpersonation collapsed={collapsed} />
            </>
          )}

          <SectionLabel collapsed={collapsed}>Principal</SectionLabel>
          {visibleMain.map(item => (
            <NavLink key={item.id} item={item} active={pathname === item.href} collapsed={collapsed} />
          ))}

          <SectionLabel collapsed={collapsed}>Módulos</SectionLabel>
          {visibleModules.map(item => (
            <NavLink key={item.id} item={item} active={pathname.startsWith(item.href)} collapsed={collapsed} />
          ))}

          {showPosSection && (
            <>
              <SectionLabel collapsed={collapsed}>POS</SectionLabel>
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
                collapsed={collapsed}
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
                collapsed={collapsed}
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
                collapsed={collapsed}
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
                collapsed={collapsed}
              />
            </>
          )}

          <SectionLabel collapsed={collapsed}>Sistema</SectionLabel>
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
              collapsed={collapsed}
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
              collapsed={collapsed}
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
              collapsed={collapsed}
            />
          )}
          {navCapabilities?.integraciones && (
            <NavLink
              item={NAV_WOOCOMMERCE}
              active={pathname.startsWith('/integraciones/woocommerce')}
              collapsed={collapsed}
            />
          )}
          {NAV_SYSTEM.filter(item => item.id !== 'configuracion' || navCapabilities?.configuracion !== false).map(item => (
            <NavLink key={item.id} item={item} active={pathname.startsWith(item.href)} collapsed={collapsed} />
          ))}
        </nav>

        {/* Desktop collapse toggle */}
        <div
          className={cn(
            'hidden flex-shrink-0 border-t border-border md:flex',
            collapsed ? 'justify-center p-1.5' : 'justify-end px-2 py-1.5',
          )}
        >
          <Tooltip content={collapsed ? 'Expandir menú' : 'Colapsar menú'} side="right">
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
              aria-expanded={!collapsed}
              data-testid="sidebar-collapse-btn"
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-md',
                'text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              <CollapseIcon collapsed={collapsed} />
            </button>
          </Tooltip>
        </div>
      </aside>
    </>
  )
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
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
      className={cn('transition-transform duration-200', collapsed && 'rotate-180')}
    >
      <path d="M10 4 6 8l4 4" />
    </svg>
  )
}

function SectionLabel({ children, collapsed }: { children: React.ReactNode; collapsed: boolean }) {
  // Desktop collapsed: no text labels (icon rail). Mobile drawer always shows them.
  return (
    <div
      className={cn(
        'px-2.5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle first:pt-1',
        collapsed && 'md:hidden',
      )}
    >
      {children}
    </div>
  )
}

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
}) {
  const { setOpen } = useSidebar()

  const link = (
    <Link
      href={item.href}
      onClick={() => setOpen(false)}
      className={cn(
        'group relative mb-0.5 flex items-center rounded-md text-[13px] transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        'h-9 gap-2.5 px-2.5',
        collapsed && 'md:h-9 md:w-9 md:justify-center md:gap-0 md:px-0',
        active
          ? 'bg-brand-accent-bg font-medium text-brand-accent'
          : 'text-fg-muted hover:bg-surface-hover hover:text-fg',
      )}
    >
      {active && (
        <span
          className={cn(
            'absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-accent',
            collapsed && 'md:hidden',
          )}
          aria-hidden
        />
      )}
      <span
        className={cn(
          'flex-shrink-0',
          active ? 'text-brand-accent' : 'text-fg-subtle group-hover:text-fg-muted',
        )}
      >
        {item.icon}
      </span>
      <span className={cn('truncate', collapsed && 'md:sr-only')}>{item.label}</span>
      {item.badge != null && (
        <span
          className={cn(
            'ml-auto flex h-4 items-center rounded-sm bg-warning-bg px-1.5 text-[10px] font-semibold text-warning',
            collapsed && 'md:hidden',
          )}
        >
          {item.badge}
        </span>
      )}
    </Link>
  )

  if (!collapsed) return link

  return (
    <Tooltip content={item.label} side="right" delayDuration={200}>
      <span className="flex md:justify-center">{link}</span>
    </Tooltip>
  )
}
