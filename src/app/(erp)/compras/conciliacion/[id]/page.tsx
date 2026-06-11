import type { Metadata } from 'next'
import { ConciliacionDetail } from './ConciliacionDetail'

export const metadata: Metadata = { title: 'Conciliación — Compras' }

type P = { params: Promise<{ id: string }> }

export default async function ConciliacionDetailPage({ params }: P) {
  const { id } = await params
  return <ConciliacionDetail id={id} />
}
