import type { Metadata } from 'next'
import { DevolucionesComprasClient } from './DevolucionesComprasClient'

export const metadata: Metadata = { title: 'Devoluciones — Compras' }

export default function DevolucionesComprasPage() {
  return <DevolucionesComprasClient />
}
