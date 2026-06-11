import type { Metadata } from 'next'
import { FacturaProvDetail } from './FacturaProvDetail'

export const metadata: Metadata = { title: 'Factura de proveedor' }

export default async function FacturaProvPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <FacturaProvDetail id={id} />
}
