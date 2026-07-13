import type { Metadata } from 'next'
import { FacturasExpensasClient } from './FacturasExpensasClient'

export const metadata: Metadata = { title: 'Facturas de gastos' }

export default function FacturasExpensasPage() {
  return <FacturasExpensasClient />
}
