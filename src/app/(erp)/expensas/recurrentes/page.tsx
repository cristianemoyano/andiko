import type { Metadata } from 'next'
import { RecurrentesClient } from './RecurrentesClient'

export const metadata: Metadata = { title: 'Gastos recurrentes' }

export default function RecurrentesPage() {
  return <RecurrentesClient />
}
