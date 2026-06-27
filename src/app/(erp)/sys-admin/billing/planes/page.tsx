import type { Metadata } from 'next'
import { PlanesClient } from './PlanesClient'

export const metadata: Metadata = { title: 'Planes de facturación — Andiko ERP' }

export default function PlanesPage() {
  return <PlanesClient />
}
