import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { resolvePostAuthRedirect } from '@/lib/post-auth-redirect'
import { BillingInvoicePrintClient } from './BillingInvoicePrintClient'

export const metadata: Metadata = { title: 'Imprimir factura — Andiko ERP' }

export default async function BillingInvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect('/login')
  if (session.user.realRole !== 'sys-admin') redirect(await resolvePostAuthRedirect(session))

  const { id } = await params
  return <BillingInvoicePrintClient invoiceId={id} />
}
