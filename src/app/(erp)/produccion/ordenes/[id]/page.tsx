import type { Metadata } from 'next'
import { OrdenDetail } from './OrdenDetail'

export const metadata: Metadata = { title: 'Orden de producción' }

export default async function OrdenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <OrdenDetail id={id} />
}
