import type { Metadata } from 'next'
import { PedidosClient } from './PedidosClient'

export const metadata: Metadata = { title: 'Pedidos — Ventas' }

export default function PedidosPage() {
  return <PedidosClient />
}
