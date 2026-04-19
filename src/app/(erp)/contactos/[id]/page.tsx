import { notFound } from 'next/navigation'
import { getContact } from '@/modules/contacts/contacts.service'
import { listAddresses } from '@/modules/contacts/contact-address.service'
import { ContactDetail } from './ContactDetail'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  try {
    const { id } = await params
    const contact = await getContact(id)
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
  let contact: Parameters<typeof ContactDetail>[0]['contact']
  let addresses: Parameters<typeof ContactDetail>[0]['addresses']
  try {
    const [c, addrs] = await Promise.all([getContact(id), listAddresses(id)])
    contact = serializeDates(c.toJSON() as unknown as Record<string, unknown>) as unknown as typeof contact
    addresses = addrs.map(a => serializeDates(a.toJSON() as unknown as Record<string, unknown>)) as unknown as typeof addresses
  } catch {
    notFound()
  }
  return <ContactDetail contact={contact} addresses={addresses} />
}
