import type { Metadata } from 'next'
import { PresupuestosClient } from './PresupuestosClient'

export const metadata: Metadata = { title: 'Presupuestos — Ventas' }

export default function PresupuestosPage() {
  return <PresupuestosClient />
}
