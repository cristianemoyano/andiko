import type { Metadata } from 'next'
import { VehiculosClient } from './VehiculosClient'

export const metadata: Metadata = { title: 'Vehículos — Logística' }

export default function VehiculosPage() {
  return <VehiculosClient />
}
