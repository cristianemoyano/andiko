import type { Metadata } from 'next'
import { DevolucionesClient } from './DevolucionesClient'

export const metadata: Metadata = { title: 'Devoluciones — Ventas' }

export default function DevolucionesPage() {
  return <DevolucionesClient />
}
