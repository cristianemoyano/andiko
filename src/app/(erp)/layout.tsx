import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { Sidebar } from '@/components/layout/Sidebar'

export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  const userName = session.user?.name ?? session.user?.email ?? undefined
  const userRole = (session.user as { role?: string })?.role ?? undefined

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50">
      <Sidebar userName={userName} userRole={userRole} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
