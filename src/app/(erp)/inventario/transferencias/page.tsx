import type { Metadata } from 'next'
import { TransferenciasClient } from './TransferenciasClient'

export const metadata: Metadata = { title: 'Transferencias — Inventario' }

export default function TransferenciasPage() {
  return <TransferenciasClient />
}
