import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getOnboardingStatus } from '@/modules/auth/onboarding.service'
import { getEffectiveOrganizationSettings, isModuleEnabled } from '@/modules/auth/organization-settings.service'
import { resolveModuleForPath, type OrgModuleKey } from '@/modules/auth/organization-modules'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { InstallPrompt } from '@/components/layout/InstallPrompt'
import { Providers } from '@/components/layout/Providers'

export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  const orgId = session.user.orgId
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? headersList.get('x-invoke-path') ?? ''

  let enabledModules: OrgModuleKey[] | undefined
  if (orgId) {
    const settings = await getEffectiveOrganizationSettings(orgId)
    enabledModules = settings.enabled_modules

    const isOnboardingRoute = pathname === '/onboarding'
    if (!isOnboardingRoute) {
      const status = await getOnboardingStatus(orgId)
      if (!status.completed) {
        redirect('/onboarding')
      }
    }

    const moduleForPath = resolveModuleForPath(pathname)
    if (moduleForPath && !(await isModuleEnabled(orgId, moduleForPath))) {
      redirect('/panel?module_disabled=1')
    }
  }

  const userName = session.user?.name ?? session.user?.email ?? undefined
  const userRole = session.user?.role ?? undefined
  const isRealSysAdmin = session.user.realRole === 'sys-admin'
  const showSysAdminNavigation = isRealSysAdmin && !session.user.impersonation

  return (
    <Providers>
      <div className="flex h-screen overflow-hidden bg-bg">
        <Sidebar
          userName={userName}
          userRole={userRole}
          isRealSysAdmin={isRealSysAdmin}
          showSysAdminNavigation={showSysAdminNavigation}
          enabledModules={enabledModules}
        />
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden overscroll-contain pt-[env(safe-area-inset-top)] md:pt-0 pb-16 md:pb-0">
          {children}
        </main>
        <BottomNav enabledModules={enabledModules} />
        <InstallPrompt />
      </div>
    </Providers>
  )
}
