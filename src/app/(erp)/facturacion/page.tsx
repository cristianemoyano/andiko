import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { resolveCapabilities } from '@/lib/capabilities'
import { resolvePostAuthRedirect } from '@/lib/post-auth-redirect'
import { FacturacionClient } from './FacturacionClient'

export const metadata: Metadata = { title: 'Facturación — Andiko ERP' }

export default async function FacturacionPage() {
  const session = await auth()
  const caps = await resolveCapabilities(session)
  if (!caps?.nav.facturacion) redirect(await resolvePostAuthRedirect(session!))

  return <FacturacionClient />
}
