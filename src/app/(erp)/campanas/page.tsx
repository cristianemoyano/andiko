import type { Metadata } from 'next'
import { CampanasClient } from './CampanasClient'

export const metadata: Metadata = { title: 'Campañas — Andiko ERP' }

export default function CampanasPage() {
  return <CampanasClient />
}
