import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { resolveCapabilities } from '@/lib/capabilities'
import { resolvePostAuthRedirect } from '@/lib/post-auth-redirect'
import { OrganizacionesAdminClient } from './OrganizacionesAdminClient'

export const metadata: Metadata = { title: 'Organizaciones' }

export default async function OrganizacionesPage() {
  const session = await auth()
  const caps = await resolveCapabilities(session)

  if (caps?.platform.listOrganizations) {
    return <OrganizacionesAdminClient />
  }

  if (caps?.nav.organizacionesHref) {
    redirect(caps.nav.organizacionesHref)
  }

  redirect(await resolvePostAuthRedirect(session!))
}
