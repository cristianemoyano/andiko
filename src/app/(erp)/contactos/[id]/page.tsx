import { notFound } from 'next/navigation'
import { getContact } from '@/modules/contacts/contacts.service'
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

async function fetchContact(id: string) {
  const contact = await getContact(id)
  const raw = contact.toJSON() as unknown as Record<string, unknown>
  return {
    ...raw,
    created_at: raw.created_at instanceof Date ? raw.created_at.toISOString() : String(raw.created_at),
    updated_at: raw.updated_at instanceof Date ? raw.updated_at.toISOString() : String(raw.updated_at),
  } as Parameters<typeof ContactDetail>[0]['contact']
}

export default async function ContactPage({ params }: Props) {
  const { id } = await params
  let contact: Parameters<typeof ContactDetail>[0]['contact']
  try {
    contact = await fetchContact(id)
  } catch {
    notFound()
  }
  return <ContactDetail contact={contact} />
}
