import type { Metadata } from 'next'
import { GastoDetail } from './GastoDetail'

export const metadata: Metadata = { title: 'Gasto' }

export default async function GastoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <GastoDetail id={id} />
}
