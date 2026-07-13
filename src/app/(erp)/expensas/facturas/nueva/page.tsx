import type { Metadata } from 'next'
import { NuevaFacturaExpensaClient } from './NuevaFacturaExpensaClient'

export const metadata: Metadata = { title: 'Nuevo gasto' }

export default function NuevaFacturaExpensaPage() {
  return <NuevaFacturaExpensaClient />
}
