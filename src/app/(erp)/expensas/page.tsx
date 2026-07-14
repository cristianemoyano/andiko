import type { Metadata } from 'next'
import { Suspense } from 'react'
import { GastosExpensasClient } from './GastosExpensasClient'

export const metadata: Metadata = { title: 'Expensas' }

export default function ExpensasPage() {
  return (
    <Suspense fallback={null}>
      <GastosExpensasClient />
    </Suspense>
  )
}
