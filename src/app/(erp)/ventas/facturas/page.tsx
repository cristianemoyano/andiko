import type { Metadata } from 'next'
import { FacturasClient } from './FacturasClient'

export const metadata: Metadata = { title: 'Facturas — Ventas' }

export default function FacturasPage() {
  return <FacturasClient />
}
