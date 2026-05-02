import type { Metadata } from 'next'
import { CajasClient } from './CajasClient'

export const metadata: Metadata = { title: 'Turnos de caja — POS' }

export default function CajasPage() {
  return <CajasClient />
}
