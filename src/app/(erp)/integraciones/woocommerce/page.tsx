import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { resolveCapabilities } from '@/lib/capabilities'
import { resolvePostAuthRedirect } from '@/lib/post-auth-redirect'
import { WoocommerceClient } from './WoocommerceClient'

export const metadata: Metadata = { title: 'WooCommerce — Andiko ERP' }

export default async function WoocommercePage() {
  const session = await auth()
  const caps = await resolveCapabilities(session)
  if (!caps?.nav.integraciones) {
    redirect(await resolvePostAuthRedirect(session!))
  }

  return <WoocommerceClient />
}
