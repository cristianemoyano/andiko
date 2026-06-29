import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getOnboardingStatus } from '@/modules/auth/onboarding.service'
import { OnboardingResumeBannerGate } from '@/components/layout/OnboardingResumeBannerGate'
import { getEffectiveOrganizationSettings, isModuleEnabled } from '@/modules/auth/organization-settings.service'
import { resolveModuleForPath, type OrgModuleKey } from '@/modules/auth/organization-modules'
import { resolveCapabilities } from '@/lib/capabilities'
import { hasModuleReadAccess } from '@/lib/nav-module-access'
import { resolveModuleAccessRedirect, SIN_ACCESO_PATH } from '@/lib/panel-access'
import { isOnboardingPath, shouldLayoutForceOnboardingRedirect } from '@/lib/onboarding-guards'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { MenuPanel } from '@/components/layout/MenuPanel'
import { InstallPrompt } from '@/components/layout/InstallPrompt'
import { Providers } from '@/components/layout/Providers'
import { capabilitiesProviderKey } from '@/components/layout/capabilities-provider-key'

export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  const orgId = session.user.orgId
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? headersList.get('x-invoke-path') ?? ''

  const [capabilities, settings] = await Promise.all([
    resolveCapabilities(session),
    orgId ? getEffectiveOrganizationSettings(orgId) : Promise.resolve(null),
  ])

  const enabledModules: OrgModuleKey[] | undefined = settings?.enabled_modules
  let showOnboardingResume = false

  if (orgId) {
    const canManageOnboarding = capabilities?.onboarding.manage ?? false

    if (canManageOnboarding) {
      const status = await getOnboardingStatus(orgId)
      if (!status.completed && status.hasProgress && !isOnboardingPath(pathname)) {
        showOnboardingResume = true
      } else if (shouldLayoutForceOnboardingRedirect(pathname, status)) {
        redirect('/onboarding')
      }
    }

    if (pathname !== SIN_ACCESO_PATH) {
      const moduleForPath = resolveModuleForPath(pathname)
      if (moduleForPath) {
        const moduleDisabled = !(await isModuleEnabled(orgId, moduleForPath))
        const moduleForbidden = capabilities
          ? !hasModuleReadAccess(moduleForPath, capabilities.permissions)
          : false

        if (moduleDisabled || moduleForbidden) {
          const target = resolveModuleAccessRedirect(
            pathname,
            capabilities,
            enabledModules,
            moduleDisabled ? 'disabled' : 'forbidden',
          )
          if (target !== pathname) redirect(target)
        }
      }
    }
  }

  const userName = session.user?.name ?? session.user?.email ?? undefined
  const userRole = session.user?.role ?? undefined
  const isRealSysAdmin = session.user.realRole === 'sys-admin'
  const showSysAdminNavigation = isRealSysAdmin && !session.user.impersonation

  return (
    <Providers
      initialCapabilities={capabilities}
      capabilitiesKey={capabilitiesProviderKey(capabilities, session)}
    >
      <div className="flex h-screen overflow-hidden bg-bg">
        <Sidebar
          userName={userName}
          userRole={userRole}
          isRealSysAdmin={isRealSysAdmin}
          showSysAdminNavigation={showSysAdminNavigation}
          enabledModules={enabledModules}
          showOnboardingResume={showOnboardingResume}
        />
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden overscroll-contain pt-[env(safe-area-inset-top)] md:pt-0 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
          {showOnboardingResume ? <OnboardingResumeBannerGate enabled /> : null}
          {children}
        </main>
        <BottomNav enabledModules={enabledModules} />
        <MenuPanel
          enabledModules={enabledModules}
          isRealSysAdmin={isRealSysAdmin}
          showSysAdminNavigation={showSysAdminNavigation}
          showOnboardingResume={showOnboardingResume}
        />
        <InstallPrompt />
      </div>
    </Providers>
  )
}
