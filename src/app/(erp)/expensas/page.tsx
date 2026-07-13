import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Expensas' }

export default function ExpensasPage() {
  redirect('/expensas/facturas')
}
