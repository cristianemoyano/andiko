import type { Metadata } from 'next'
import { SalidasClient } from './SalidasClient'

export const metadata: Metadata = { title: 'Salidas — Logística' }

export default function SalidasPage() {
  return <SalidasClient />
}
