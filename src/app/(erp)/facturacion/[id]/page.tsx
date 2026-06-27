import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { resolveCapabilities } from '@/lib/capabilities'
import { resolvePostAuthRedirect } from '@/lib/post-auth-redirect'
import { InvoiceDetail } from './InvoiceDetail'

export const metadata: Metadata = { title: 'Factura — Andiko ERP' }

export default async function FacturaPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const caps = await resolveCapabilities(session)
  if (!caps?.nav.facturacion) redirect(await resolvePostAuthRedirect(session!))

  const { id } = await params
  return <InvoiceDetail invoiceId={id} />
}
