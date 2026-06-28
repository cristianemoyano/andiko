import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { orgHasWoocommerceSites } from '@/modules/integrations/woocommerce/woo-sites.service'
import { CatalogoClient } from '../CatalogoClient'

export const metadata: Metadata = { title: 'Productos — Catálogo' }

export default async function ProductosPage() {
  const session = await auth()
  const showWooColumn = session?.user?.orgId
    ? await orgHasWoocommerceSites(session.user.orgId)
    : false

  return <CatalogoClient showWooColumn={showWooColumn} />
}
