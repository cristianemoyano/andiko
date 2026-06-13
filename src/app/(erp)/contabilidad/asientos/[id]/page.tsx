import type { Metadata } from 'next'
import { AsientoDetail } from './AsientoDetail'

export const metadata: Metadata = { title: 'Detalle de asiento — Contabilidad' }

export default async function AsientoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AsientoDetail id={id} />
}
