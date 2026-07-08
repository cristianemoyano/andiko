import type { Metadata } from 'next'
import { NuevaSalidaClient } from './NuevaSalidaClient'

export const metadata: Metadata = { title: 'Nueva salida — Logística' }

export default function NuevaSalidaPage() {
  return <NuevaSalidaClient />
}
