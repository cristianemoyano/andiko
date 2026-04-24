import type { Metadata } from 'next'
import { OrdenesClient } from './OrdenesClient'

export const metadata: Metadata = { title: 'Órdenes de compra' }

export default function OrdenesPage() {
  return <OrdenesClient />
}
