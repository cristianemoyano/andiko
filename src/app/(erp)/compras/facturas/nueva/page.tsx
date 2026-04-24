import type { Metadata } from 'next'
import { NuevaFacturaProvClient } from './NuevaFacturaProvClient'

export const metadata: Metadata = { title: 'Nueva factura de proveedor' }

export default function NuevaFacturaPage() {
  return <NuevaFacturaProvClient />
}
