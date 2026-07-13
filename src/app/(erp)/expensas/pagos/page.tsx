import type { Metadata } from 'next'
import { PagosExpensasClient } from './PagosExpensasClient'

export const metadata: Metadata = { title: 'Pagos de gastos' }

export default function PagosExpensasPage() {
  return <PagosExpensasClient />
}
