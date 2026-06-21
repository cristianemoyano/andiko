import type { Metadata } from 'next'
import { BalanzasClient } from './BalanzasClient'

export const metadata: Metadata = { title: 'Balanzas POS — Andiko ERP' }

export default function BalanzasPage() {
  return <BalanzasClient />
}
