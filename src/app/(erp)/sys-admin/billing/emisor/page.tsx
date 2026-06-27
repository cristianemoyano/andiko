import type { Metadata } from 'next'
import { EmisorClient } from './EmisorClient'

export const metadata: Metadata = { title: 'Datos del emisor — Andiko ERP' }

export default function EmisorPage() {
  return <EmisorClient />
}
