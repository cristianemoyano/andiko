import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getOnboardingStatus } from '@/modules/auth/onboarding.service'
import { OnboardingResumeBannerGate } from '@/components/layout/OnboardingResumeBannerGate'
import { getEffectiveOrganizationSettings, isModuleEnabled } from '@/modules/auth/organization-settings.service'
import { resolveModuleForPath, type OrgModuleKey } from '@/modules/auth/organization-modules'
import { resolveCapabilities } from '@/lib/capabilities'
import { hasModuleReadAccess } from '@/lib/nav-module-access'
import { resolveDefaultLandingPath } from '@/lib/panel-access'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { InstallPrompt } from '@/components/layout/InstallPrompt'
import { Providers } from '@/components/layout/Providers'
import { capabilitiesProviderKey } from '@/components/layout/capabilities-provider-key'

export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  const orgId = session.user.orgId
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? headersList.get('x-invoke-path') ?? ''

  const capabilities = await resolveCapabilities(session)
  let enabledModules: OrgModuleKey[] | undefined
  let showOnboardingResume = false

  if (orgId) {
    const settings = await getEffectiveOrganizationSettings(orgId)
    enabledModules = settings.enabled_modules

    const canManageOnboarding = capabilities?.onboarding.manage ?? false

    if (canManageOnboarding) {
      const isOnboardingRoute = pathname.startsWith('/onboarding')
      const status = await getOnboardingStatus(orgId)
      if (!status.completed && status.hasProgress && !isOnboardingRoute) {
        showOnboardingResume = true
      } else if (!status.completed && !isOnboardingRoute && !status.hasProgress) {
        redirect('/onboarding')
      }
    }

    const moduleForPath = resolveModuleForPath(pathname)
    if (moduleForPath && !(await isModuleEnabled(orgId, moduleForPath))) {
      redirect(`${resolveDefaultLandingPath(capabilities, enabledModules)}?module_disabled=1`)
    }
    if (moduleForPath && capabilities && !hasModuleReadAccess(moduleForPath, capabilities.permissions)) {
      redirect(`${resolveDefaultLandingPath(capabilities, enabledModules)}?module_forbidden=1`)
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
        <InstallPrompt />
      </div>
    </Providers>
  )
}
