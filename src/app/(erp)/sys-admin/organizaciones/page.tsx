import type { Metadata } from 'next'
import { OrganizacionesAdminClient } from './OrganizacionesAdminClient'

export const metadata: Metadata = { title: 'Organizaciones — Sys-admin' }

export default function OrganizacionesAdminPage() {
  return <OrganizacionesAdminClient />
}
