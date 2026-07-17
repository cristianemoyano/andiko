import type { Metadata } from 'next'
import { CierresClient } from './CierresClient'

export const metadata: Metadata = { title: 'Cierres de período — Contabilidad' }

export default function CierresPage() {
  return <CierresClient />
}
