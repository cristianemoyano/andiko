import { notFound } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { auth } from '@/lib/auth'
import type { AuthedSession } from '@/lib/api-handler'
import { getPriceList } from '@/modules/catalog/price-list.service'
import { PriceListDetailClient } from './price-list-detail-client'
import { CatalogoSubNav } from '../../CatalogoSubNav'

export const metadata = { title: 'Lista de precios — Andiko ERP' }

export default async function PriceListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) notFound()
  const authed = session as AuthedSession

  const orgId = authed.user.orgId
  if (!orgId) notFound()

  let priceList: Awaited<ReturnType<typeof getPriceList>> | null = null
  try {
    priceList = await getPriceList(id, orgId)
  } catch {
    priceList = null
  }
  if (!priceList) notFound()

  const pl = priceList.toJSON() as unknown as {
    id: string
    name: string
    description: string | null
    is_default: boolean
    is_active: boolean
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Catálogo', href: '/catalogo/productos' },
          { label: 'Listas de precios', href: '/catalogo/listas-de-precios' },
          { label: priceList.name },
        ]}
      />

      <CatalogoSubNav />
      <PriceListDetailClient priceList={pl} />
    </div>
  )
}

