import type { Metadata } from 'next'
import { SuspendidoClient } from './SuspendidoClient'

export const metadata: Metadata = { title: 'Suscripción suspendida — Andiko ERP' }

export default function SuspendidoPage() {
  return <SuspendidoClient />
}
