import type { Metadata } from 'next'
import { TarjetasClient } from './TarjetasClient'

export const metadata: Metadata = { title: 'Tarjetas — Expensas' }

export default function TarjetasPage() {
  return <TarjetasClient />
}
