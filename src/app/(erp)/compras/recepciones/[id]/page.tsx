import type { Metadata } from 'next'
import { RecepcionDetail } from './RecepcionDetail'

export const metadata: Metadata = { title: 'Recepción de mercadería' }

export default async function RecepcionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <RecepcionDetail id={id} />
}
