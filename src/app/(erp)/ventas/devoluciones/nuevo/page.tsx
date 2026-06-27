import type { Metadata } from 'next'
import { NuevaDevolucionClient } from './NuevaDevolucionClient'

export const metadata: Metadata = { title: 'Nueva devolución — Ventas' }

export default function NuevaDevolucionPage() {
  return <NuevaDevolucionClient />
}
