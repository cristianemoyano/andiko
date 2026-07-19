import type { Metadata } from 'next'
import { CampanaFormClient } from '../CampanaFormClient'

export const metadata: Metadata = { title: 'Nueva campaña — Andiko ERP' }

export default function NuevaCampanaPage() {
  return <CampanaFormClient />
}
