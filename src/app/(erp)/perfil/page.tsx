import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { resolveActorId, type AuthedSession } from '@/lib/api-handler'
import { getUserProfile } from '@/modules/auth/profile.service'
import { PerfilClient } from './PerfilClient'

export const metadata = { title: 'Mi perfil — Andiko ERP' }

export default async function PerfilPage() {
  const session = await auth() as AuthedSession | null
  if (!session) redirect('/login')

  const userId = resolveActorId(session)
  const profile = await getUserProfile(userId)
  if (!profile) redirect('/login')

  return (
    <PerfilClient
      initial={profile}
      isImpersonating={!!session.user.impersonation}
    />
  )
}
