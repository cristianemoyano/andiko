import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { resolveCapabilities } from '@/lib/capabilities'
import { resolvePostAuthRedirect } from '@/lib/post-auth-redirect'
import { resolveOrgIdForMutation } from '@/lib/session-org'
import { OrgDetailClient } from './OrgDetailClient'

export const metadata: Metadata = { title: 'Organización' }

type Props = { params: Promise<{ id: string }> }

export default async function OrgDetailPage({ params }: Props) {
  const session = await auth()
  const caps = await resolveCapabilities(session)

  if (!caps?.organizacion.detail) {
    redirect(await resolvePostAuthRedirect(session!))
  }

  const { id } = await params
  const orgId = await resolveOrgIdForMutation({
    orgId: session?.user.orgId ?? null,
    actingOrgId: session?.user.actingOrgId,
    role: session!.user.role,
    realRole: session!.user.realRole,
  })

  if (!caps.platform.listOrganizations && orgId && orgId !== id) {
    redirect(`/organizaciones/${orgId}`)
  }

  return <OrgDetailClient id={id} />
}
