'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { useSidebar } from './SidebarContext'
import { NAV_MAIN, NAV_MODULES, NAV_SYSTEM, NAV_WOOCOMMERCE, isModuleNavVisible, type NavItem } from './nav-items'
import { type OrgModuleKey } from '@/modules/auth/organization-modules'
import { useCapabilities } from './CapabilitiesContext'
import { SysAdminImpersonation } from './SysAdminImpersonation'
import { AppVersion } from './AppVersion'

interface MenuPanelProps {
  enabledModules?: OrgModuleKey[]
  isRealSysAdmin?: boolean
  /** Show link to Organizaciones: real sys-admin and not impersonating */
  showSysAdminNavigation?: boolean
  /** Onboarding incompleto con progreso guardado */
  showOnboardingResume?: boolean
}

/**
 * Mobile-only full-screen menu panel. Renders inside the ERP layout so it's
 * always pre-rendered — tapping "Menú" in BottomNav toggles visibility
 * instantly with a CSS transition, no navigation or network delay.
 */
export function MenuPanel({
  enabledModules,
  isRealSysAdmin = false,
  showSysAdminNavigation: showSysAdminNavigationInitial = false,
  showOnboardingResume = false,
}: MenuPanelProps) {
  const { menuOpen, setMenuOpen, setOpen } = useSidebar()
  const pathname = usePathname()
  const { data: session } = useSession()
  const { capabilities } = useCapabilities()

  const navCapabilities = capabilities?.nav ?? null
  const permissions = capabilities?.permissions

  const showSysAdminNavigation = session?.user
    ? session.user.realRole === 'sys-admin' && !session.user.impersonation
    : showSysAdminNavigationInitial

  const showPanel = navCapabilities?.panel === true
  const visibleMain = NAV_MAIN.filter(item => item.id !== 'dashboard' || showPanel)
  const visibleModules = NAV_MODULES.filter(item => isModuleNavVisible(item.id, enabledModules, permissions))
  const showPosSection = isModuleNavVisible('pos-dispositivos', enabledModules, permissions)

  const displayName = session?.user?.name ?? session?.user?.email ?? '—'
  const displayRole = session?.user?.role ?? ''
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'

  useEffect(() => { setMenuOpen(false) }, [pathname, setMenuOpen])

  function close() { setMenuOpen(false); setOpen(false) }

  return (
    <div
      className={cn(
        'md:hidden fixed inset-x-0 top-0 z-[48] bg-surface overflow-y-auto',
        'bottom-[calc(4rem+env(safe-area-inset-bottom))]',
        'transition-transform duration-200 ease-out',
        menuOpen ? 'translate-y-0' : 'translate-y-full',
      )}
      role="dialog"
      aria-modal={menuOpen}
      aria-label="Menú de navegación"
      aria-hidden={!menuOpen}
    >
      <div style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        {/* Header */}
        <div className="flex items-center h-[52px] px-4 border-b border-border flex-shrink-0">
          <span className="text-[17px] font-semibold text-fg tracking-tight flex-1">Menú</span>
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar menú"
            className="p-2 -mr-2 text-fg-muted hover:text-fg transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* User profile */}
        <Link
          href="/perfil"
          onClick={close}
          className="flex items-center gap-3 px-4 py-4 border-b border-border hover:bg-surface-muted transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-brand-accent-bg text-brand-accent text-sm font-semibold flex items-center justify-center flex-shrink-0 ring-1 ring-brand-accent-border/60">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-fg truncate">{displayName}</div>
            {displayRole && <div className="text-[13px] text-fg-muted truncate">{displayRole}</div>}
          </div>
          <ChevronRight />
        </Link>

        {/* Admin section — real sys-admin only. Nav links hide while impersonating,
            but the impersonation control stays so it can be switched/stopped on mobile. */}
        {isRealSysAdmin && (
          <MenuSection label="Administración">
            {showSysAdminNavigation && (
              <>
                <MenuRow
                  item={{
                    id: 'sys-admin-orgs',
                    label: 'Organizaciones',
                    href: '/organizaciones',
                    icon: (
                      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M3 14h10M3 10h10M5 6h6M5 2h6M2 14V6l6-4 6 4v8"/>
                      </svg>
                    ),
                  }}
                  active={pathname.startsWith('/organizaciones')}
                  onNavigate={close}
                />
                <MenuRow
                  item={{
                    id: 'sys-admin-email',
                    label: 'Email (SMTP)',
                    href: '/sys-admin/email',
                    icon: (
                      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <rect x="1.5" y="3" width="13" height="10" rx="1"/><path d="m2 4 6 5 6-5"/>
                      </svg>
                    ),
                  }}
                  active={pathname.startsWith('/sys-admin/email')}
                  onNavigate={close}
                />
                <MenuRow
                  item={{
                    id: 'sys-admin-storage',
                    label: 'Almacenamiento',
                    href: '/sys-admin/storage',
                    icon: (
                      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 4.5 8 1.5l6 3v7L8 14.5 2 11.5v-7z"/><path d="M8 1.5v13"/>
                      </svg>
                    ),
                  }}
                  active={pathname.startsWith('/sys-admin/storage')}
                  onNavigate={close}
                />
                <MenuRow
                  item={{
                    id: 'sys-admin-billing',
                    label: 'Facturación',
                    href: '/sys-admin/billing',
                    icon: (
                      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="12" height="10" rx="1"/><path d="M2 6h12M5 10h3"/>
                      </svg>
                    ),
                  }}
                  active={pathname.startsWith('/sys-admin/billing')}
                  onNavigate={close}
                />
              </>
            )}
            <div className="px-4 py-2">
              <SysAdminImpersonation />
            </div>
          </MenuSection>
        )}

        {/* Principal */}
        {visibleMain.length > 0 && (
          <MenuSection label="Principal">
            {visibleMain.map(item => (
              <MenuRow
                key={item.id}
                item={item}
                active={pathname === item.href}
                onNavigate={close}
              />
            ))}
          </MenuSection>
        )}

        {/* Modules */}
        <MenuSection label="Módulos">
          {visibleModules.map(item => (
            <MenuRow
              key={item.id}
              item={item}
              active={pathname.startsWith(item.href)}
              onNavigate={close}
            />
          ))}
        </MenuSection>

        {/* POS */}
        {showPosSection && (
          <MenuSection label="POS">
            <MenuRow
              item={{
                id: 'pos-dispositivos',
                label: 'Dispositivos',
                href: '/pos/dispositivos',
                icon: (
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <rect x="1" y="3" width="14" height="10" rx="1.5"/><path d="M5 13v2M11 13v2M3 15h10"/>
                  </svg>
                ),
              }}
              active={pathname === '/pos/dispositivos'}
              onNavigate={close}
            />
            <MenuRow
              item={{
                id: 'pos-cajas',
                label: 'Turnos de caja',
                href: '/pos/cajas',
                icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                ),
              }}
              active={pathname.startsWith('/pos/cajas')}
              onNavigate={close}
            />
            <MenuRow
              item={{
                id: 'pos-medios-de-pago',
                label: 'Medios de pago',
                href: '/pos/medios-de-pago',
                icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                  </svg>
                ),
              }}
              active={pathname.startsWith('/pos/medios-de-pago')}
              onNavigate={close}
            />
            <MenuRow
              item={{
                id: 'pos-balanzas',
                label: 'Balanzas',
                href: '/pos/balanzas',
                icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v2M5 5h14l-2.5 6h-9L5 5zM3.5 11h17"/><path d="M6 11l-2 7h6l-2-7M18 11l-2 7h6l-2-7M9 21h6"/>
                  </svg>
                ),
              }}
              active={pathname.startsWith('/pos/balanzas')}
              onNavigate={close}
            />
          </MenuSection>
        )}

        {/* Sistema */}
        <MenuSection label="Sistema">
          {showOnboardingResume && !pathname.startsWith('/onboarding') && (
            <MenuRow
              item={{
                id: 'onboarding-resume',
                label: 'Configuración inicial',
                href: '/onboarding',
                icon: (
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 1.5"/>
                  </svg>
                ),
              }}
              active={pathname.startsWith('/onboarding')}
              onNavigate={close}
            />
          )}
          {navCapabilities?.organizaciones && navCapabilities.organizacionesHref && !showSysAdminNavigation && (
            <MenuRow
              item={{
                id: 'organizacion',
                label: 'Organización',
                href: navCapabilities.organizacionesHref,
                icon: (
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M3 14h10M3 10h10M5 6h6M5 2h6M2 14V6l6-4 6 4v8"/>
                  </svg>
                ),
              }}
              active={pathname.startsWith('/organizaciones')}
              onNavigate={close}
            />
          )}
          {navCapabilities?.facturacion && (
            <MenuRow
              item={{
                id: 'facturacion',
                label: 'Suscripción',
                href: '/facturacion',
                icon: (
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="12" height="10" rx="1"/><path d="M2 6h12M5 10h3"/>
                  </svg>
                ),
              }}
              active={pathname.startsWith('/facturacion')}
              onNavigate={close}
            />
          )}
          {navCapabilities?.integraciones && (
            <MenuRow
              item={{
                ...NAV_WOOCOMMERCE,
                icon: (
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h12v10H2z"/><path d="M2 6h12M5 9h2M9 9h2"/>
                  </svg>
                ),
              }}
              active={pathname.startsWith('/integraciones/woocommerce')}
              onNavigate={close}
            />
          )}
          {NAV_SYSTEM.filter(item => item.id !== 'configuracion' || navCapabilities?.configuracion !== false).map(item => (
            <MenuRow
              key={item.id}
              item={item}
              active={pathname.startsWith(item.href)}
              onNavigate={close}
            />
          ))}
        </MenuSection>

        {/* Logout */}
        <div className="px-4 py-6">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-sm border border-border text-[14px] text-fg-muted hover:text-fg hover:bg-surface-muted transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M10 11l3-3-3-3M13 8H6"/>
            </svg>
            Cerrar sesión
          </button>
          <div className="mt-3 flex justify-center">
            <AppVersion />
          </div>
        </div>
      </div>
    </div>
  )
}

function MenuSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <div className="px-4 pt-3 pb-1 text-[11px] font-semibold text-fg-subtle uppercase tracking-widest">
        {label}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  )
}

function MenuRow({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-3 px-4 h-12 transition-colors',
        active ? 'text-brand-accent bg-brand-accent-bg' : 'text-fg hover:bg-surface-muted',
      )}
    >
      <span className={cn('flex-shrink-0', active ? 'text-brand-accent' : 'text-fg-subtle')}>
        {item.icon}
      </span>
      <span className="flex-1 text-[15px]">{item.label}</span>
      {item.badge != null && (
        <span className="text-[10px] font-semibold bg-warning-bg text-warning rounded-sm px-1.5 h-4 flex items-center">
          {item.badge}
        </span>
      )}
      <ChevronRight className={active ? 'text-brand-accent-border' : undefined} />
    </Link>
  )
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('text-fg-subtle flex-shrink-0', className)}
      aria-hidden
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}
