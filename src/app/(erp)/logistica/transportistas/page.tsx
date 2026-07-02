import type { Metadata } from 'next'
import { TransportistasClient } from './TransportistasClient'

export const metadata: Metadata = { title: 'Transportistas — Logística' }

export default function TransportistasPage() {
  return <TransportistasClient />
}
