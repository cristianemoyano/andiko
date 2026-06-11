import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Compras' }

export default function ComprasPage() {
  redirect('/compras/ordenes')
}
