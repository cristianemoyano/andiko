import type { Metadata } from 'next'
import { ReturnDetail } from './ReturnDetail'

export const metadata: Metadata = { title: 'Devolución — Ventas' }

export default function ReturnDetailPage() {
  return <ReturnDetail />
}
