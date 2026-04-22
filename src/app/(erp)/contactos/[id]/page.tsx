import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import type { AuthedSession } from '@/lib/api-handler'
import { makeTenantContext } from '@/lib/tenancy'
import { getContact } from '@/modules/contacts/contacts.service'
import { listAddresses } from '@/modules/contacts/contact-address.service'
import { listPaymentInfo } from '@/modules/contacts/contact-payment-info.service'
import { ContactDetail } from './ContactDetail'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user) return { title: 'Contacto — Andiko ERP' }
    const ctxTenant = await makeTenantContext((session as AuthedSession).user)
    const contact = await getContact(id, ctxTenant)
    return { title: `${contact.legal_name} — Andiko ERP` }
  } catch {
    return { title: 'Contacto — Andiko ERP' }
  }
}

function serializeDates(raw: Record<string, unknown>) {
  return {
    ...raw,
    created_at: raw.created_at instanceof Date ? raw.created_at.toISOString() : String(raw.created_at),
    updated_at: raw.updated_at instanceof Date ? raw.updated_at.toISOString() : String(raw.updated_at),
    deleted_at: raw.deleted_at instanceof Date ? raw.deleted_at.toISOString() : (raw.deleted_at ?? null),
  }
}

export default async function ContactPage({ params }: Props) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) notFound()
  const ctxTenant = await makeTenantContext((session as AuthedSession).user)
  let contact: Parameters<typeof ContactDetail>[0]['contact']
  let addresses: Parameters<typeof ContactDetail>[0]['addresses']
  let paymentInfo: Parameters<typeof ContactDetail>[0]['paymentInfo']
  try {
    const [c, addrs, pinfo] = await Promise.all([
      getContact(id, ctxTenant),
      listAddresses(id, ctxTenant),
      listPaymentInfo(id, ctxTenant),
    ])
    contact     = serializeDates(c.toJSON() as unknown as Record<string, unknown>) as unknown as typeof contact
    addresses   = addrs.map(a => serializeDates(a.toJSON() as unknown as Record<string, unknown>)) as unknown as typeof addresses
    paymentInfo = pinfo.map(p => serializeDates(p.toJSON() as unknown as Record<string, unknown>)) as unknown as typeof paymentInfo
  } catch {
    notFound()
  }
  return <ContactDetail contact={contact} addresses={addresses} paymentInfo={paymentInfo} />
}
