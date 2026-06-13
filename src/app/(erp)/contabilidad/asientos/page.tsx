import type { Metadata } from 'next'
import { AsientosClient } from './AsientosClient'

export const metadata: Metadata = { title: 'Asientos — Contabilidad' }

export default function AsientosPage() {
  return <AsientosClient />
}
