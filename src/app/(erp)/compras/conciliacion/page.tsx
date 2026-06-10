import type { Metadata } from 'next'
import { ConciliacionClient } from './ConciliacionClient'

export const metadata: Metadata = { title: 'Conciliación — Compras' }

export default function ConciliacionPage() {
  return <ConciliacionClient />
}
