import type { Metadata } from 'next'
import { DevolucionCompraDetail } from './DevolucionCompraDetail'

export const metadata: Metadata = { title: 'Devolución — Compras' }

export default function DevolucionCompraDetailPage() {
  return <DevolucionCompraDetail />
}
