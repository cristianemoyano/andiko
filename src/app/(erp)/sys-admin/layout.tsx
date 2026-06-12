import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export default async function SysAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')
  if (session.user.realRole !== 'sys-admin') redirect('/panel')
  if (session.user.impersonation) redirect('/panel')

  return <>{children}</>
}
