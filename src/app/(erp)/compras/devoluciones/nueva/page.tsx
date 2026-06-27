import type { Metadata } from 'next'
import { NuevaDevolucionCompraClient } from './NuevaDevolucionCompraClient'

export const metadata: Metadata = { title: 'Nueva devolución — Compras' }

export default function NuevaDevolucionCompraPage() {
  return <NuevaDevolucionCompraClient />
}
