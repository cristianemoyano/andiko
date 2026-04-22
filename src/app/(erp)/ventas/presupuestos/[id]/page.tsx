import type { Metadata } from 'next'
import { QuoteDetail } from './QuoteDetail'

export const metadata: Metadata = { title: 'Detalle de presupuesto — Ventas' }

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <QuoteDetail id={id} />
}
