import type { Metadata } from 'next'
import { TarjetaDetailClient } from './TarjetaDetailClient'

export const metadata: Metadata = { title: 'Tarjeta — Expensas' }

export default async function TarjetaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <TarjetaDetailClient id={id} />
}
