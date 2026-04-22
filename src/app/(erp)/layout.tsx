import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { Sidebar } from '@/components/layout/Sidebar'
import { Providers } from '@/components/layout/Providers'

export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  const userName = session.user?.name ?? session.user?.email ?? undefined
  const userRole = session.user?.role ?? undefined
  const isRealSysAdmin = session.user.realRole === 'sys-admin'
  const showSysAdminNavigation = isRealSysAdmin && !session.user.impersonation

  return (
    <Providers>
      <div className="flex h-screen overflow-hidden bg-zinc-50">
        <Sidebar
          userName={userName}
          userRole={userRole}
          isRealSysAdmin={isRealSysAdmin}
          showSysAdminNavigation={showSysAdminNavigation}
        />
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {children}
        </main>
      </div>
    </Providers>
  )
}
