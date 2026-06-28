import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { orgHasWoocommerceSites } from '@/modules/integrations/woocommerce/woo-sites.service'
import { ContactosClient } from './ContactosClient'

export const metadata: Metadata = { title: 'Contactos — Andiko ERP' }

export default async function ContactosPage() {
  const session = await auth()
  const showWooColumn = session?.user?.orgId
    ? await orgHasWoocommerceSites(session.user.orgId)
    : false

  return <ContactosClient showWooColumn={showWooColumn} />
}
