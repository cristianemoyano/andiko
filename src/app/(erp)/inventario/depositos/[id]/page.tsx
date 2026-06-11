import type { Metadata } from 'next'
import { DepositoDetail } from './DepositoDetail'

export const metadata: Metadata = { title: 'Depósito — Inventario' }

export default function DepositoDetailPage() {
  return <DepositoDetail />
}
