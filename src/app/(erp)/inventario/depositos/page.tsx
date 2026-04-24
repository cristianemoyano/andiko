import type { Metadata } from 'next'
import { DepositosClient } from './DepositosClient'

export const metadata: Metadata = { title: 'Depósitos — Inventario' }

export default function DepositosPage() {
  return <DepositosClient />
}
