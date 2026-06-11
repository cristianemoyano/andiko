import type { Metadata } from 'next'
import { RemitosClient } from './RemitosClient'

export const metadata: Metadata = { title: 'Remitos de entrega' }

export default function RemitosPage() {
  return <RemitosClient />
}
