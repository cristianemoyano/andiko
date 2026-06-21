import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { resolvePostAuthRedirect } from '@/lib/post-auth-redirect'

export default async function SysAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')
  if (session.user.realRole !== 'sys-admin') redirect(await resolvePostAuthRedirect(session))
  if (session.user.impersonation) redirect(await resolvePostAuthRedirect(session))

  return <>{children}</>
}
