import type { Metadata } from 'next'
import { SalidaDetail } from './SalidaDetail'

export const metadata: Metadata = { title: 'Salida — Logística' }

export default async function SalidaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <SalidaDetail id={id} />
}
