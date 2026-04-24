import type { Metadata } from 'next'
import { MovimientosClient } from './MovimientosClient'

export const metadata: Metadata = { title: 'Movimientos — Inventario' }

export default function MovimientosPage() {
  return <MovimientosClient />
}
