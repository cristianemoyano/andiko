import type { Metadata } from 'next'
import { ShipmentDetail } from './ShipmentDetail'

export const metadata: Metadata = { title: 'Envío — Logística' }

export default async function EnvioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ShipmentDetail id={id} />
}
