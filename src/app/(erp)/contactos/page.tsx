import type { Metadata } from 'next'
import { ContactosClient } from './ContactosClient'

export const metadata: Metadata = { title: 'Contactos — Andiko ERP' }

export default function ContactosPage() {
  return <ContactosClient />
}
