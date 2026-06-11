import type { Metadata } from 'next'
import { FacturasProvClient } from './FacturasProvClient'

export const metadata: Metadata = { title: 'Facturas de proveedor' }

export default function FacturasPage() {
  return <FacturasProvClient />
}
