import type { Metadata } from 'next'
import { NuevaRecepcionClient } from './NuevaRecepcionClient'

export const metadata: Metadata = { title: 'Nueva recepción — Compras' }

export default function NuevaRecepcionPage() {
  return <NuevaRecepcionClient />
}
