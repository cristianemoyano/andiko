import type { Metadata } from 'next'
import { NuevoPedidoClient } from './NuevoPedidoClient'

export const metadata: Metadata = { title: 'Nuevo pedido — Ventas' }

export default function NuevoPedidoPage() {
  return <NuevoPedidoClient />
}
