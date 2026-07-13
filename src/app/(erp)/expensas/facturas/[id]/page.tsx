import type { Metadata } from 'next'
import { FacturaExpensaDetail } from './FacturaExpensaDetail'

export const metadata: Metadata = { title: 'Gasto' }

export default async function FacturaExpensaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <FacturaExpensaDetail id={id} />
}
