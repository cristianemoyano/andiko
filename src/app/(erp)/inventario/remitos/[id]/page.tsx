import type { Metadata } from 'next'
import { RemitoDetail } from './RemitoDetail'

export const metadata: Metadata = { title: 'Remito de entrega' }

export default async function RemitoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <RemitoDetail id={id} />
}
