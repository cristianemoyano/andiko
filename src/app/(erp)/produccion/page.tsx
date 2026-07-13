import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Producción' }

export default function ProduccionPage() {
  redirect('/produccion/ordenes')
}
