import type { Metadata } from 'next'
import { PagosProvClient } from './PagosProvClient'

export const metadata: Metadata = { title: 'Pagos a proveedores' }

export default function PagosPage() {
  return <PagosProvClient />
}
