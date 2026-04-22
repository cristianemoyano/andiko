import type { Metadata } from 'next'
import { OrderDetail } from './OrderDetail'

export const metadata: Metadata = { title: 'Detalle de pedido — Ventas' }

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <OrderDetail id={id} />
}
